
// data-scraper.js
// Combines Open Data GTFS‑R (trains + trams) with static GTFS (platforms),
// includes ANY city‑bound train, prioritises South Yarra Platform 5, and returns a snapshot.

import dayjs from "dayjs";
import config from "./config.js";
import {
  getMetroTripUpdates,
  getMetroServiceAlerts,
  getTramTripUpdates,
  getTramServiceAlerts
} from "./opendata.js";
import { tryLoadStops, resolveSouthYarraIds, buildTargetStopIdSet } from "./gtfs-static.js";

// In‑memory cache to reduce upstream calls (and honour provider caching)
const mem = {
  cacheUntil: 0,
  snapshot: null,
  gtfs: null,
  ids: null,
  targetStopIdSet: null
};

function nowMs() { return Date.now(); }

/**
 * Extract a numeric epoch (ms) for a stop_time_update (arrival or departure).
 */
function timeFromStu(stu) {
  const sec = Number(stu?.departure?.time || stu?.arrival?.time || 0);
  return sec ? sec * 1000 : 0;
}

/**
 * Return true if the trip update will call at any of the target stop_ids
 * after the current South Yarra call (city‑bound heuristic).
 */
function isCityBoundTrip(tripUpdate, targetStopIds, southYarraStopId, southYarraSeq) {
  if (!tripUpdate?.stop_time_update?.length) return false;

  // Identify sequence of current South Yarra call (if not provided, we still allow any future match)
  const currentSeq = southYarraSeq ?? (() => {
    const idx = tripUpdate.stop_time_update.findIndex(s => s.stop_id === southYarraStopId);
    return idx >= 0 ? Number(tripUpdate.stop_time_update[idx].stop_sequence ?? idx) : 0;
  })();

  // Any downstream stop matching our CBD targets?
  return tripUpdate.stop_time_update.some(su => {
    const seq = Number(su.stop_sequence ?? 0);
    const isDownstream = !Number.isNaN(seq) ? seq > currentSeq : true;
    return isDownstream && targetStopIds.has(su.stop_id);
  });
}

/**
 * Sort departures: earliest first, but if within 2 minutes, prefer Platform 5.
 */
function sortWithPlatformPreference(list, preferredStopId) {
  const WINDOW_MS = 2 * 60 * 1000; // 2 minutes
  return list.sort((a, b) => {
    const dt = a.when - b.when;
    if (Math.abs(dt) <= WINDOW_MS && (a.stopId === preferredStopId || b.stopId === preferredStopId)) {
      return a.stopId === preferredStopId ? -1 : 1;
    }
    return dt;
  });
}

/**
 * Pluck header timestamp (ms) safely from a GTFS‑R feed.
 */
function headerTs(feed) {
  return (feed?.header?.timestamp ? Number(feed.header.timestamp) * 1000 : 0);
}

/**
 * Main snapshot builder
 */
export async function getSnapshot(apiKey) {
  const now = nowMs();
  if (mem.snapshot && now < mem.cacheUntil) return mem.snapshot;

  // Load static GTFS (for platforms + station name->stop_id mapping)
  if (!mem.gtfs) mem.gtfs = tryLoadStops();

  // Resolve South Yarra ids + platform 5 stop_id
  if (!mem.ids) mem.ids = resolveSouthYarraIds(config, mem.gtfs);

  // Build a set of stop_ids for city‑bound targets (Parliament, State Library, etc.)
  if (!mem.targetStopIdSet) {
    mem.targetStopIdSet = buildTargetStopIdSet(mem.gtfs, config.cityBoundTargetStopNames || []);
  }

  const snapshotBase = {
    meta: { generatedAt: new Date().toISOString(), sources: {} },
    trains: [],
    trams: [],
    alerts: { metro: 0, tram: 0 },
    notes: {
      platformResolution: {
        usedStaticGtfs: !!(mem.gtfs?.stops?.length),
        southYarra: {
          parentStopId: mem.ids?.parentStopId || null,
          platform5StopId: mem.ids?.platform5StopId || null,
          platformCount: mem.ids?.allPlatformStopIds?.length || 0
        }
      }
    }
  };

  // If API key missing, return minimal snapshot (endpoints still work)
  if (!apiKey) {
    mem.snapshot = snapshotBase;
    mem.cacheUntil = now + (config.cacheSeconds ? config.cacheSeconds * 1000 : 60000);
    return mem.snapshot;
  }

  // Pull GTFS‑R feeds in parallel (Trip Updates + Service Alerts)
  const mBase = config.feeds.metro.base;
  const tBase = config.feeds.tram.base;

  const [metroTU, metroSA, tramTU, tramSA] = await Promise.all([
    getMetroTripUpdates(apiKey, mBase).catch(e => (console.warn("Metro TU error:", e.message), null)),
    getMetroServiceAlerts(apiKey, mBase).catch(e => (console.warn("Metro SA error:", e.message), null)),
    getTramTripUpdates(apiKey, tBase).catch(e => (console.warn("Tram TU error:", e.message), null)),
    getTramServiceAlerts(apiKey, tBase).catch(e => (console.warn("Tram SA error:", e.message), null))
  ]);

  // Record feed timestamps
  snapshotBase.meta.sources = {
    metroTripUpdatesTs: headerTs(metroTU),
    metroServiceAlertsTs: headerTs(metroSA),
    tramTripUpdatesTs: headerTs(tramTU),
    tramServiceAlertsTs: headerTs(tramSA)
  };

  // ==== TRAINS (Metro) — include ANY city‑bound, prioritise South Yarra Platform 5 ====
  const southYarraPlatformIds = new Set(mem.ids?.allPlatformStopIds || []);
  const platform5StopId = mem.ids?.platform5StopId || null;

  if (metroTU?.entity?.length) {
    const trainDeps = [];

    for (const ent of metroTU.entity) {
      const tu = ent.trip_update;
      if (!tu?.stop_time_update?.length) continue;

      // Must call at South Yarra (any platform)
      const syStu = tu.stop_time_update.find(s => southYarraPlatformIds.has(s.stop_id));
      if (!syStu) continue;

      const when = timeFromStu(syStu);
      if (!when) continue;

      // City‑bound filter: true if downstream contains any of the target CBD stops
      const cityBound = isCityBoundTrip(
        tu,
        mem.targetStopIdSet,
        syStu.stop_id,
        Number(syStu.stop_sequence ?? 0)
      );
      if (!cityBound) continue;

      trainDeps.push({
        tripId: tu.trip?.trip_id || ent.id,
        routeId: tu.trip?.route_id || null,
        stopId: syStu.stop_id,
        when,
        delaySec: Number(syStu.departure?.delay || syStu.arrival?.delay || 0),
        platformPreferred: platform5StopId && syStu.stop_id === platform5StopId
      });
    }

    snapshotBase.trains = sortWithPlatformPreference(trainDeps, platform5StopId).slice(0, 12);
  }

  // Alerts (count only — you can surface text in your renderer if you like)
  snapshotBase.alerts.metro = metroSA?.entity?.length || 0;

  // ==== TRAMS (Yarra Trams) — minimal: earliest system-wide (you can filter Route 58/Tivoli) ====
  if (tramTU?.entity?.length) {
    const tramDeps = [];
    for (const ent of tramTU.entity) {
      const tu = ent.trip_update;
      if (!tu?.stop_time_update?.length) continue;
      const stu = tu.stop_time_update[0];
      const when = timeFromStu(stu);
      if (!when) continue;

      tramDeps.push({
        tripId: tu.trip?.trip_id || ent.id,
        routeId: tu.trip?.route_id || null,
        stopId: stu.stop_id,
        when,
        delaySec: Number(stu.departure?.delay || stu.arrival?.delay || 0)
      });
    }
    snapshotBase.trams = tramDeps.sort((a, b) => a.when - b.when).slice(0, 12);
  }

  snapshotBase.alerts.tram = tramSA?.entity?.length || 0;

  // Cache snapshot
  mem.snapshot = snapshotBase;
  mem.cacheUntil = now + (config.cacheSeconds ? config.cacheSeconds * 1000 : 60000);
  return mem.snapshot;
}

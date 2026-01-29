# 🚆 Complete Beginner's Guide to PTV-TRMNL
## Your Personal Melbourne Transit Display - Made Easy!

**Hello!** 👋 Welcome to your journey of creating your own personalized Melbourne public transport display. This guide will walk you through every single step, from opening the box to seeing live train times on your display.

**You can do this!** This guide is written for everyone, no matter your tech experience. We'll go slowly, explain everything, and make sure you succeed.

---

## 📋 What You'll Need (Checklist)

Before we start, let's gather everything. Check off each item as you get it ready:

- [ ] **Your TRMNL e-ink display** (or compatible ESP32 device) - This is the small screen
- [ ] **USB cable** - Should come with your device (USB-C or Micro-USB)
- [ ] **A computer** - Windows, Mac, or Linux all work!
- [ ] **Chrome or Edge browser** - We'll install this if you don't have it
- [ ] **WiFi name and password** - Write these down before you start
- [ ] **30-60 minutes of uninterrupted time** - You can pause and come back!
- [ ] **A cup of tea or coffee** ☕ - You've got this!

**Don't worry if something goes wrong** - There's a troubleshooting section for every step!

---

## 🎯 Overview: What We're Going To Do

Here's the big picture. We're going to do 5 main things:

```
Step 1: Get Your Free API Keys        ⏱️ 10 minutes
        └─ We'll sign up for free accounts

Step 2: Set Up Your Server            ⏱️ 15 minutes
        └─ This is where your data lives (it's free!)

Step 3: Flash Your Display            ⏱️ 10 minutes
        └─ Put the software on your device

Step 4: Connect to WiFi               ⏱️ 5 minutes
        └─ Let your display talk to the internet

Step 5: Configure Your Preferences    ⏱️ 10 minutes
        └─ Tell it what trains/trams you want to see
```

**Total time: About 50 minutes**

Don't worry - we'll do these one at a time, and you can take breaks!

---

## 🚀 Step 1: Get Your Free API Keys

**What is this?** API keys are like permission slips that let our program get real-time train data. They're completely free!

### 1.1 Get Your PTV OpenData API Key (Required)

**⏱️ Time: 5-10 minutes**

**What is PTV?** Public Transport Victoria - they provide all the train/tram/bus data!

1. **Open your browser** and go to: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/

2. **Click "Get Your API Key"** or scroll down to find the registration form

3. **Fill in the form:**
   - Your name
   - Your email address
   - Reason: "Personal project - transit display"

4. **Submit the form**

5. **Check your email** - You'll get an email within a few minutes with:
   - Your **API Key** (looks like: `ce606b90-9ffb-43e8-bcd7-0c2bd0498367`)
   - Your **Developer ID** (a long number)

6. **📝 IMPORTANT: Write these down!**
   - Create a text file on your desktop called "ptv-keys.txt"
   - Copy and paste both keys into this file
   - Save it - you'll need these later!

**✅ Success Check:** You should have two long codes saved in a text file.

**❓ Having trouble?**
- Email not arriving? Check your spam folder
- Form not working? Try a different browser (Chrome/Firefox)
- Need help? The PTV help desk is friendly: data@ptv.vic.gov.au

---

### 1.2 Get Google Places API Key (Optional - Makes Cafe Search Better)

**Can I skip this?** Yes! The system works without it. Google Places just makes finding your favorite cafe easier.

**⏱️ Time: 5 minutes**

**What is this?** Google Places helps you search for cafes by name (like "Everyday Coffee" instead of typing the full address).

1. **Go to:** https://console.cloud.google.com/

2. **Sign in** with your Google account (Gmail)

3. **Create a new project:**
   - Click "Select a project" at the top
   - Click "New Project"
   - Name it: "ptv-trmnl"
   - Click "Create"

4. **Enable Places API:**
   - In the search bar, type "Places API"
   - Click on "Places API"
   - Click "Enable"

5. **Create an API key:**
   - Go to "Credentials" in the left menu
   - Click "Create Credentials" → "API Key"
   - Copy the key that appears

6. **📝 Save your key:**
   - Add this to your "ptv-keys.txt" file
   - Label it: "Google Places Key: [paste key here]"

**✅ Success Check:** You have a third key saved (optional).

**❓ Having trouble?**
- **Google account needed** - If you don't have one, this step is optional
- **Credit card required?** - Google asks for one but won't charge for normal use (we use very few API calls)
- **Want to skip it?** - Absolutely fine! The system works great without it

---

## 🌐 Step 2: Set Up Your Server (The Easy Way!)

**What is this?** Your "server" is where all the magic happens - it fetches train times and creates the image for your display. We're using Render.com which is **free** and takes care of everything!

**⏱️ Time: 15 minutes**

### 2.1 Create a Render Account

1. **Go to:** https://render.com/

2. **Click "Get Started"** (top right)

3. **Sign up using GitHub:**
   - Click "Sign up with GitHub"
   - Create a GitHub account if you don't have one (it's free!)
   - Authorize Render to access GitHub

**✅ Success Check:** You're now logged into Render.com

---

### 2.2 Fork the Repository

**What's a "fork"?** Think of it like making your own copy of the software that you can customize.

1. **Go to:** https://github.com/angusbergman17-cpu/einkptdashboard

2. **Click the "Fork" button** (top right)

3. **Click "Create Fork"**

**✅ Success Check:** You now have your own copy at: `github.com/[YOUR-USERNAME]/einkptdashboard`

---

### 2.3 Deploy to Render

**This is where it all comes together!**

1. **Go back to Render.com** (in your browser)

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repository:**
   - Click "Connect account" if needed
   - Find "einkptdashboard" in the list
   - Click "Connect"

4. **Configure your service:**

   Fill in these fields exactly as shown:

   - **Name:** `ptv-trmnl` (or any name you like)
   - **Region:** Choose closest to Melbourne (Singapore or Sydney)
   - **Branch:** `main`
   - **Root Directory:** Leave blank
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`

5. **Add your API keys as Environment Variables:**

   Click "Advanced" → "Add Environment Variable"

   Add these THREE variables (get them from your ptv-keys.txt file):

   ```
   ODATA_API_KEY = [Your PTV Developer ID]
   ODATA_TOKEN = [Your PTV API Key]
   NODE_ENV = production
   ```

   If you have Google Places (optional):
   ```
   GOOGLE_PLACES_KEY = [Your Google Places Key]
   ```

6. **Click "Create Web Service"**

7. **Wait for deployment:**
   - You'll see a log screen with scrolling text
   - This takes 3-5 minutes
   - ✅ When you see "Server running on port 3000" - you're done!

8. **Copy your URL:**
   - At the top, you'll see a URL like: `https://ptv-trmnl.onrender.com`
   - 📝 **Save this!** This is your server address
   - Add it to your ptv-keys.txt file as "Server URL: [paste url]"

**✅ Success Check:**
- Visit your URL in a browser
- You should see a page with links (Admin Panel, Setup Wizard, etc.)
- It might take 30 seconds to wake up the first time - this is normal!

**❓ Having trouble?**
- **Build failed?** - Check that all environment variables are spelled exactly right (no extra spaces)
- **Server not starting?** - Look at the logs for red error messages - usually it's a missing API key
- **URL not loading?** - Render free tier "sleeps" after 15 minutes of no use - just wait 30 seconds and refresh

---

## 📱 Step 3: Flash Your Display (Put Software On The Device)

**What is this?** "Flashing" means putting our software onto your physical device. It's like installing an app, but for hardware.

**⏱️ Time: 10 minutes**

**🎯 IMPORTANT:** Use Chrome or Edge browser for this step. Firefox and Safari don't support the Web Serial API we need.

### Method 1: Use Our Automated Web Tool (Easiest!)

1. **Connect your device:**
   - Plug your TRMNL display into your computer with the USB cable
   - Turn it on if it has a power switch

2. **Go to your server URL:**
   - Open: `https://[your-render-url]/admin/setup-wizard`
   - You should see "Step 5: Device Setup"
   - Click through to Step 5 if you're on Step 1

3. **Download the firmware:**
   - Scroll down to "Firmware File"
   - Click the "Download Latest Firmware" button
   - Save the `.bin` file to your Downloads folder

4. **Use the Web Flasher:**
   - Go to: https://esp.huhn.me/ (ESP32 Web Flasher tool)
   - Click "Connect"
   - Select your device from the popup (it might say "USB Serial" or "CP210x")
   - Click "Choose File" and select the `.bin` file you downloaded
   - Click "Program"
   - Wait for the progress bar to reach 100% (about 2 minutes)

5. **Done!**
   - You'll see "Programming successful!"
   - Unplug and replug your device

**✅ Success Check:** The device restarts and shows "WiFi Setup" or a configuration screen.

---

### Method 2: Command Line (For Linux/Mac Users)

**If you're comfortable with Terminal:**

```bash
# Install esptool
pip install esptool

# Download firmware from your server
curl https://[your-render-url]/firmware/firmware.bin > firmware.bin

# Flash (replace /dev/ttyUSB0 with your port)
esptool.py --port /dev/ttyUSB0 write_flash 0x0 firmware.bin
```

---

**❓ Having trouble?**

**"Can't find my device"**
- **Windows:** Install CH340 or CP210x USB drivers
- **Mac:** Some cables are charge-only - try a different USB cable
- **Linux:** You might need to add yourself to the `dialout` group: `sudo usermod -a -G dialout $USER`

**"Permission denied"**
- **Linux/Mac:** Run with `sudo`
- **Windows:** Run browser as Administrator

**"Verification failed"**
- Try unplugging and replugging the device
- Hold the "BOOT" button while connecting (some ESP32 boards)
- Try a different USB port

**"Web flasher not working"**
- Make sure you're using Chrome or Edge (not Firefox/Safari)
- Try the Command Line method instead

---

## 📡 Step 4: Connect Your Display to WiFi

**What is this?** Your display needs internet to get train times. We'll connect it to your WiFi network.

**⏱️ Time: 5 minutes**

**This is the easy part!**

### 4.1 Access Configuration Portal

1. **After flashing, your device creates a WiFi network:**
   - Look for a WiFi network called "TRMNL-Setup" or "ESP32-Setup"
   - Connect to it from your phone or computer
   - Password (if asked): `12345678`

2. **A webpage should open automatically**
   - If it doesn't, open a browser and go to: `http://192.168.4.1`

3. **Configure WiFi:**
   - Click "Configure WiFi"
   - Select your home WiFi network from the list
   - Enter your WiFi password
   - Click "Save"

4. **Add your Server URL:**
   - In the "Webhook URL" field, paste: `https://[your-render-url]/api/screen`
   - Click "Save"

5. **Device will restart and connect!**

**✅ Success Check:**
- Your device should show "Connected!" and start displaying train times
- If you see an error, check the troubleshooting below

---

**❓ Having trouble?**

**"Can't see the TRMNL-Setup network"**
- Wait 30 seconds after flashing - it takes a moment to start
- Try unplugging and replugging the device
- Hold the "RESET" button on the device

**"Wrong password" for my WiFi**
- Double-check your WiFi password (WiFi passwords are case-sensitive!)
- Try typing it in again carefully

**"Connected but no display"**
- Check your server URL is correct
- Make sure it ends with `/api/screen`
- Visit your server URL in a browser to make sure it's awake

---

## ⚙️ Step 5: Configure Your Preferences

**What is this?** Now we tell the system which trains/trams YOU want to see!

**⏱️ Time: 10 minutes**

### 5.1 Open Admin Panel

1. **Go to:** `https://[your-render-url]/admin`

2. **You'll see the Admin Panel** with a nice purple gradient header

---

### 5.2 Fill In Your Addresses

**Scroll to "User Preferences" section**

1. **Home Address:**
   - Start typing your home address
   - Select it from the dropdown that appears
   - ✅ You'll see a green checkmark when it's saved

2. **Preferred Cafe:** (Optional but fun!)
   - Type your favorite cafe name or address
   - Select from the dropdown
   - ✅ Green checkmark means it's saved

3. **Work Address:**
   - Type your work/destination address
   - Select from the dropdown
   - ✅ Green checkmark

**💡 Tip:** The autocomplete works best if you include the suburb (e.g., "123 Smith St, Collingwood")

---

### 5.3 Set Your Journey Details

**Still in the "User Preferences" section:**

1. **Default Arrival Time:**
   - What time do you need to arrive at work?
   - Example: `09:00`

2. **Enable Coffee Stop:**
   - ☑️ Check this if you want the system to factor in your coffee stop
   - Choose where: Before first transit / Between transits / After last transit

3. **Transit Modes:**
   - ☑️ Check which transport you use:
     - 🚆 Trains
     - 🚊 Trams
     - 🚌 Buses
     - 🚄 V/Line

4. **Transit Route Configuration:**
   - How many modes do you use? 1 or 2?
   - Fill in your typical stations
   - Example:
     - Mode 1: Train from "South Yarra" to "Flinders Street" (20 min)
     - Mode 2: Tram from "Flinders Street" to "Melbourne University" (15 min)

---

### 5.4 Save Everything!

1. **Scroll down to the green "Save All Preferences" button**

2. **Click it!**

3. **You'll see:**
   - A loading spinner
   - A success message "Preferences saved successfully!"
   - The system will automatically test your PTV API connection

**✅ Success Check:** Green success message at the bottom of the page

---

### 5.5 Test Your Setup!

1. **Scroll to "Smart Route Planner" card**

2. **Click "Calculate Route"**

3. **You should see:**
   - Your complete journey plan
   - Walking times
   - Coffee time included
   - When to leave home
   - Which trains/trams to catch

**🎉 SUCCESS!** If you see this, everything is working!

---

## 🎯 What Happens Next?

Your display will now:
- ✅ Update every 30 seconds with fresh data
- ✅ Show your next departures
- ✅ Factor in your coffee stop time
- ✅ Calculate when you need to leave
- ✅ Display weather information
- ✅ Use real-time data (delays, disruptions)

**The display "sleeps" when not in use** and wakes up when it's time to show your commute!

---

## 🔧 Customizing Your Display

### Change What Time It Shows

Go to your Admin Panel → User Preferences → Change "Default Arrival Time"

### Add or Remove Transport Modes

Go to Admin Panel → User Preferences → Check/uncheck train/tram/bus boxes

### Change Your Cafe

Go to Admin Panel → User Preferences → Update "Preferred Cafe"

### See Live Preview

Go to: `https://[your-render-url]/admin` → Click "Preview Display" in Quick Actions

---

## ❓ Troubleshooting

### Display Shows Error Message

**"No API Key"**
- Go to Render.com → Your service → Environment → Check `ODATA_API_KEY` and `ODATA_TOKEN` are set

**"No Data"**
- Check your PTV API keys are correct
- Make sure your server is awake (visit the URL in a browser)

**"Connection Failed"**
- Check the Webhook URL on your device is correct
- It should end with `/api/screen`

### Display Is Blank

- Press the reset button on the device
- Check WiFi is connected (see device's serial output)
- Make sure your server URL is correct

### Wrong Trains Showing

- Go to Admin Panel → User Preferences
- Check your home/work addresses are correct
- Check your arrival time is what you want
- Save preferences again

### Data Is Old / Not Updating

- Go to Admin Panel → Click "Clear Cache" in Quick Actions
- Wait 30 seconds for fresh data

---

## 🆘 Need More Help?

### Check the Logs

Go to: `https://[your-render-url]/admin/troubleshooting`
- Click "System Logs" tab
- Look for red error messages
- These tell you exactly what's wrong!

### Test Your API

Go to your Admin Panel → Click "Test Configuration" button
- This checks if all your API keys work

### Still Stuck?

1. **Read the error message carefully** - it usually tells you what's wrong!
2. **Try turning it off and on again** - seriously, this fixes 80% of issues
3. **Check the TESTING-GUIDE.md** for detailed testing procedures
4. **Open a GitHub issue** with:
   - What step you're on
   - What error message you see
   - Screenshots help!

---

## 🎉 You Did It!

Congratulations! You now have a personal Melbourne transit display that:
- Shows real-time departures
- Factors in your coffee stop
- Tells you when to leave
- Updates automatically
- Looks beautiful on e-ink!

**Enjoy your new display!** 🚆☕✨

---

## 📚 What's Next?

- **Explore the Admin Panel** - Lots of cool features!
- **Try the Setup Wizard** - Interactive guide built right in
- **Check out Troubleshooting Tools** - Advanced debugging
- **Customize the Display** - Edit templates (advanced)

---

## 💚 Support This Project

If this guide helped you, consider:
- ⭐ Star the project on GitHub
- ☕ Buy the creator a coffee: https://buymeacoffee.com/angusbergman
- 🐛 Report bugs to help improve it
- 💬 Share with other transit enthusiasts!

---

**Last Updated:** January 24, 2026
**Guide Version:** 2.0 (Beginner-Friendly Edition)
**Written with ❤️ for public transport enthusiasts**

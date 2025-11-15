# Team-23


# 🌾 Crop Recommendation & Weather Insights Platform

A smart Agritech project that helps farmers choose the best crops based on **weather conditions**, **soil nutrients**, and **regional factors**. This platform integrates multiple APIs and provides a clean, visual dashboard.

---

## 🚀 Overview

This project is a **web application** (not a mobile or dedicated app). It runs directly in the browser and can be accessed by farmers or users from any device without installation.
Farmers often struggle with deciding which crops to plant due to unpredictable weather and limited soil data. This project solves that by:

* Fetching **live weather data** using OpenWeatherMap API.
* Fetching **soil nutrient and soil pH data** using FAO Soil Data API.
* Combining this data using predefined logic to recommend suitable crops.
* Displaying everything on a smart, visual dashboard.

---

## 🎯 Objective

To help farmers make data‑driven decisions by providing:

* Best crop recommendations.
* Weather insights.
* Soil property visualizations (pH, nutrients, moisture, etc.).

---

## 🧩 Features

* 🌦 **Live Weather Insights** (rainfall, humidity, temperature)
* 🌱 **Soil Nutrient Analysis** (pH, nitrogen, phosphorus, potassium, etc.)
* 📊 **Dashboard Visualization** (charts for weather + soil)
* 🌾 **Crop Recommendation Engine** based on:

  * Soil pH levels
  * Rainfall range
  * Temperature range
  * Nutrient availability

---

## 🛠 Technologies Used

* **Frontend:** React / HTML / CSS / JavaScript
* **Backend:** Node.js / Express or Python Flask
* **APIs:**

  * OpenWeatherMap API
  * FAO SoilGrid API
* **Visualization:** Chart.js / Recharts / D3.js

---

## 🔗 API Integration

### 1. OpenWeatherMap API

Used to fetch:

* Temperature
* Rainfall (precipitation)
* Humidity
* Wind speed

Example Call:

```
https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}
```

### 2. FAO Soil Data API (SoilGrids)

Used to get:

* Soil pH
* Clay, silt, sand
* Organic carbon
* Nutrients (NPK)

Example Call:

```
https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}&property=phh2o
```

---

## 🌾 Crop Recommendation Logic

You can define thresholds like:

| Crop      | Rainfall   | Temperature | Soil pH   |
| --------- | ---------- | ----------- | --------- |
| Rice      | High       | Low-Medium  | 5.5 – 6.5 |
| Wheat     | Low-Medium | Cool        | 6.0 – 7.5 |
| Maize     | Medium     | Warm        | 5.8 – 7.0 |
| Sugarcane | High       | Hot         | 6.5 – 7.5 |

Logic Example:

```
if rainfall > 200mm and temperature < 25°C:
    recommend "Rice"
```

---

## 📊 Dashboard Modules

1. **Weather Card** – shows current temperature, rainfall, and forecasts
2. **Soil Card** – pH, nutrients, moisture
3. **Charts** – rainfall vs temperature graph, soil pH gauge
4. **Recommended Crops Section** – list of crops + explanation

---

## 📁 Folder Structure

```
project/
│── backend/
│   ├── app.js
│   ├── routes/
│   ├── controllers/
│   └── services/
│── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── charts/
│── README.md
```

---

## ▶️ How to Run

### Backend

```
cd backend
npm install
npm start
```

### Frontend

```
cd frontend
npm install
npm run dev
```

---

## 💡 Why This Project Works

* Combines multiple APIs → shows real programming skills.
* Agriculture theme → good for impactful hackathons.
* Visualization + logic + API → perfect full-stack integration.
* Easy to extend (add ML crop prediction later).

---

## ⭐ Future Enhancements

* Machine Learning crop prediction model
* Pest detection
* Fertilizer recommendation
* Offline mode for rural areas

---

## 🧑‍🌾 Made For Hackathons

This project is:

* Unique
* Practical
* Easy to demo
* Scalable

---

## 🤝 Contributing

Feel free to open issues or submit PRs.

---

## 📞 Contact

For any help, reach out anytime!

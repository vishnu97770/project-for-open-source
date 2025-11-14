location.js
document.getElementById("continueBtn").addEventListener("click", () => {
  const value = document.getElementById("locationInput").value.trim();
  if(!value){
    alert("Please enter a PIN code or location name");
    return;
  }
  const url = new URL("../Dashboard/dashboard.html", location.href);
  url.searchParams.set("query", value);
  location.href = url.toString();
});

document.getElementById("currentLocationBtn").addEventListener("click", () => {
  if(!navigator.geolocation){
    alert("Geolocation not supported on this browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude, longitude} = pos.coords;
    const url = new URL("../Dashboard/dashboard.html", location.href);
    url.searchParams.set("lat", latitude);
    url.searchParams.set("lon", longitude);
    location.href = url.toString();
  }, err=>{
    alert("Could not get location: " + err.message);
  }, {enableHighAccuracy:true, timeout:10000});
});
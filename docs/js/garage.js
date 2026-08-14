document.addEventListener("DOMContentLoaded", () => {
  const car = document.getElementById("ferrari-model");
  if (!car) return;
  const views = {
    FRONT: "0deg 72deg 4.6m",
    SIDE: "90deg 72deg 4.8m",
    REAR: "180deg 72deg 4.6m",
    COCKPIT: "0deg 82deg 1.65m",
  };
  const label = document.getElementById("garage-view-label");
  const buttons = [...document.querySelectorAll("[data-garage-view]")];
  function setView(name) {
    car.autoRotate = false;
    car.cameraOrbit = views[name] || views.SIDE;
    label.textContent = name;
    buttons.forEach((b) =>
      b.classList.toggle("active", b.dataset.garageView === name),
    );
    document.querySelector(".garage").classList.add("garage-focus");
    setTimeout(
      () => document.querySelector(".garage").classList.remove("garage-focus"),
      700,
    );
  }
  buttons.forEach((b) =>
    b.addEventListener("click", () => setView(b.dataset.garageView)),
  );
  car.addEventListener("click", () => {
    car.autoRotate = !car.autoRotate;
    if (label)
      label.textContent = car.autoRotate ? "AUTO ROTATE" : "MANUAL CONTROL";
  });
  car.addEventListener("dblclick", () => {
    car.cameraOrbit = "35deg 68deg 4.8m";
    car.autoRotate = true;
    label.textContent = "AUTO ROTATE";
    buttons.forEach((b) => b.classList.remove("active"));
  });
  const vals = {
    speed: 312,
    throttle: 94,
    brake: 0,
    ers: 78,
    tyre: "SOFT",
    points: 117,
    form: "89",
  };
  function animate() {
    vals.speed = 300 + Math.round(Math.random() * 24);
    vals.throttle = 84 + Math.round(Math.random() * 16);
    vals.brake = Math.random() < 0.82 ? 0 : 100;
    vals.ers = 68 + Math.round(Math.random() * 25);
    document.getElementById("hud-speed").textContent = `${vals.speed} KM/H`;
    document.getElementById("hud-throttle").textContent = `${vals.throttle}%`;
    document.getElementById("hud-brake").textContent = vals.brake
      ? "BRAKING"
      : "OPEN";
    document.getElementById("hud-ers").textContent = `${vals.ers}%`;
    document.getElementById("hud-points").textContent = vals.points;
    document.getElementById("hud-form").textContent = vals.form;
    setTimeout(animate, 1100);
  }
  animate();
  setView("SIDE");
});

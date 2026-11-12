
// Kamus Global
const BROKER = "wss://broker.hivemq.com:8884/mqtt";
const TOPIK = "spoonsteady/telemetry/demo";

let client = null;
let peran = "sensor";
let sudutSekarang = 0;
let suapanTerhitung = 0;
let sedangMenyuap = false;
let waktuTerakhir = 0;
let sensorAktif = false;

// Algoritma Mencatat Log
function catatLog(teks) {
  const box = document.getElementById("logBox");
  const jam = new Date().toLocaleTimeString();

  box.innerHTML = `[${jam}] ${teks}<br>` + box.innerHTML;
}

// Algoritma Memilih Mode
function pilihMode(mode) {
  peran = mode;

  document.getElementById("btnRole1").classList.toggle("active", mode === "sensor");
  document.getElementById("btnRole2").classList.toggle("active", mode === "monitor");

  document.getElementById("panelSensor").style.display =
    mode === "sensor" ? "block" : "none";

  document.getElementById("panelMonitor").style.display =
    mode === "monitor" ? "block" : "none";

  catatLog("Beralih ke mode: " +
    (mode === "sensor" ? "HP 1 (Sendok)" : "HP 2 (Meja)"));
}

// Algoritma Memulai Sistem
function mulaiSistem() {
  if (client && client.connected) {
    catatLog("Sistem sudah terhubung.");
    return;
  }

  catatLog("Menghubungkan ke broker MQTT...");

  const tombol = document.getElementById("btnStart");
  tombol.innerText = "Menghubungkan...";
  tombol.disabled = true;

  try {
    client = mqtt.connect(BROKER);

    client.on("connect", function () {
      document.getElementById("mqttStatus").innerText =
        "Terhubung (Online)";

      document.getElementById("mqttStatus").className = "online";

      tombol.innerText = "Sistem Aktif";
      tombol.disabled = false;

      catatLog("Berhasil terhubung ke broker HiveMQ!");

      client.subscribe(TOPIK);
    });

    client.on("message", function (topik, pesan) {
      if (topik !== TOPIK || peran !== "monitor") return;

      try {
        const data = JSON.parse(pesan.toString());
        perbaruiMonitor(data);
      } catch (err) {
        catatLog("Data MQTT tidak valid.");
      }
    });

    client.on("error", function (err) {
      catatLog("Kesalahan MQTT: " + err.message);
    });

    client.on("close", function () {
      document.getElementById("mqttStatus").innerText =
        "Terputus (Offline)";

      document.getElementById("mqttStatus").className = "offline";

      tombol.innerText = "Mulai Sistem";
      tombol.disabled = false;

      catatLog("Koneksi MQTT terputus.");
    });

  } catch (e) {
    catatLog("Gagal menjalankan MQTT: " + e.message);

    tombol.innerText = "Mulai Sistem";
    tombol.disabled = false;
    return;
  }

  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    DeviceMotionEvent.requestPermission()
      .then(izin => {
        if (izin === "granted") {
          aktifkanSensor();
        } else {
          catatLog("Izin sensor ditolak!");
        }
      })
      .catch(e => catatLog("Kesalahan izin sensor: " + e));
  } else {
    aktifkanSensor();
  }
}

// Algoritma Mengaktifkan Sensor
function aktifkanSensor() {
  if (sensorAktif) return;
  sensorAktif = true;

  catatLog("Membaca pergerakan sensor...");

  window.addEventListener("deviceorientation", function (e) {
    if (peran !== "sensor") return;

    if (e.beta !== null && e.beta !== undefined) {
      sudutSekarang = Math.round(e.beta);

      document.getElementById("dispPitch").innerText =
        sudutSekarang + "°";
    }
  });

  window.addEventListener("devicemotion", function (e) {
    if (peran !== "sensor") return;

    const acc = e.accelerationIncludingGravity;
    if (!acc) return;

    const ax = acc.x || 0;
    const ay = acc.y || 0;
    const az = acc.z || 0;

    const total = Math.sqrt(ax * ax + ay * ay + az * az);
    const getaran = Math.abs(total - 9.81);

    if (sudutSekarang === 0 && (ay !== 0 || az !== 0)) {
      sudutSekarang = Math.round(
        Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * (180 / Math.PI)
      );

      document.getElementById("dispPitch").innerText =
        sudutSekarang + "°";
    }

    document.getElementById("dispRms").innerText =
      getaran.toFixed(2) + " m/s²";

    const sekarang = Date.now();

    if (
      peran === "sensor" &&
      client &&
      client.connected &&
      sekarang - waktuTerakhir > 250
    ) {
      waktuTerakhir = sekarang;

      const data = {
        rms: Number(getaran.toFixed(2)),
        pitch: sudutSekarang
      };

      client.publish(TOPIK, JSON.stringify(data));
    }
  });
}

// Algoritma Memperbarui Monitor
function perbaruiMonitor(data) {
  if (
    typeof data.rms !== "number" ||
    typeof data.pitch !== "number" ||
    !Number.isFinite(data.rms) ||
    !Number.isFinite(data.pitch)
  ) {
    return;
  }

  let skor = Math.max(10, Math.round(100 - (data.rms * 25)));

  document.getElementById("dispScore").innerText =
    skor + "%";

  if (data.pitch > 35 && !sedangMenyuap) {
    sedangMenyuap = true;

  } else if (data.pitch < 15 && sedangMenyuap) {
    sedangMenyuap = false;
    suapanTerhitung++;

    document.getElementById("dispScoop").innerText =
      suapanTerhitung + " Kali";

    catatLog("Suapan terdeteksi: " + suapanTerhitung);
  }
}

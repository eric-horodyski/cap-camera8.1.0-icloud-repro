import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <h1>Camera iCloud Repro</h1>
  <p>Issue: <a href="https://github.com/ionic-team/capacitor-plugins/issues/1807">#1807</a></p>
  <p class="instructions">
    <strong>Steps to reproduce:</strong><br>
    1. Enable iCloud Photos with "Optimize iPhone Storage"<br>
    2. Ensure some photos exist <em>only</em> in iCloud (not downloaded locally)<br>
    3. Tap a button below and select an iCloud-only photo
  </p>

  <div class="actions">
    <button id="getPhoto">Camera.getPhoto()</button>
    <button id="pickImages">Camera.pickImages()</button>
  </div>

  <pre id="log"></pre>
  <div id="preview"></div>
`;

function log(msg: string) {
  const el = document.getElementById("log")!;
  const ts = new Date().toLocaleTimeString();
  el.textContent += `[${ts}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

function showImage(webPath: string) {
  const preview = document.getElementById("preview")!;
  const img = document.createElement("img");
  img.src = webPath;
  preview.appendChild(img);
}

document.getElementById("getPhoto")!.addEventListener("click", async () => {
  log("Calling Camera.getPhoto()...");
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      source: CameraSource.Photos,
      resultType: CameraResultType.Uri,
    });
    log(`Success! webPath = ${photo.webPath}`);
    if (photo.webPath) showImage(photo.webPath);
  } catch (err: any) {
    log(`ERROR: ${err.message ?? err}`);
  }
});

document.getElementById("pickImages")!.addEventListener("click", async () => {
  log("Calling Camera.pickImages()...");
  try {
    const result = await Camera.pickImages({ quality: 90 });
    log(`Success! ${result.photos.length} photo(s) returned`);
    result.photos.forEach((photo) => {
      if (photo.webPath) showImage(photo.webPath);
    });
  } catch (err: any) {
    log(`ERROR: ${err.message ?? err}`);
  }
});

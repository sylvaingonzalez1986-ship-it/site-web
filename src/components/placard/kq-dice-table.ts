import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { KQ_DIE_FACES, KQ_DIE_SIDE, KQ_DICE_HZ, readKqTopFace, restKqDice, retargetKqDie, simulateKqDice } from "@/lib/kanab-quest-dice-physics";

const pipCells = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

function makeFaceTexture(value: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, 128, 128);
  for (const cell of pipCells[value - 1]) {
    const x = 33 + cell % 3 * 31;
    const y = 33 + Math.floor(cell / 3) * 31;
    const shade = ctx.createLinearGradient(x, y - 10, x + 2, y + 10);
    shade.addColorStop(0, "#0c2424");
    shade.addColorStop(.78, "#273d38");
    shade.addColorStop(1, "#718278");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x, y, 10.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const valid = (values: number[]) => (values.length === 3 || values.length === 4)
  && values.every(value => Number.isInteger(value) && value > 0 && value < 7);
const tint = (value: number, index: number, validated: boolean) => index === 3 ? 0xb1bcae
  : !validated ? 0xfff4d5 : value === 1 ? 0xf29680 : value === 6 ? 0xf6c552 : value >= 4 ? 0x79d8bc : 0xfffaf0;

export function createKqDiceTable(stage: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, .1, 30);
  camera.position.set(0, 10, 5.2);
  camera.lookAt(0, .68, .08);
  scene.add(new THREE.HemisphereLight(0xfffcf0, 0xb5cdba, 1.8));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.05);
  key.position.set(-2.5, 8, -1.8);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -4.7, right: 4.7, top: 4, bottom: -4, near: .1, far: 16 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = .016;
  scene.add(key, key.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), new THREE.ShadowMaterial({ opacity: .26 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const geometry = new RoundedBoxGeometry(KQ_DIE_SIDE, KQ_DIE_SIDE, KQ_DIE_SIDE, 3, .103);
  const maps = KQ_DIE_FACES.map(makeFaceTexture);
  const dice = Array.from({ length: 4 }, () => {
    const mesh = new THREE.Mesh(geometry, maps.map(map => new THREE.MeshStandardMaterial({ map, roughness: .54, metalness: .02 })));
    mesh.visible = false;
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  });

  let frame = 0;
  let finish: (() => void) | undefined;
  let disposed = false;
  const draw = () => { if (!disposed) renderer.render(scene, camera); };
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const aspect = width / height;
    const halfHeight = Math.max(2.12, 3.64 / aspect);
    Object.assign(camera, { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight });
    camera.updateProjectionMatrix();
    renderer.setSize(Math.round(width), Math.round(height), false);
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  function colors(values: number[], validated: boolean) {
    dice.forEach((die, index) => {
      die.visible = index < values.length;
      if (die.visible) die.material.forEach(material => material.color.setHex(tint(values[index], index, validated)));
    });
  }
  function check(values: number[]) {
    const faces = dice.filter(die => die.visible).map(die => readKqTopFace(die.quaternion).face);
    stage.dataset.topFaces = faces.join(",");
    return faces.length === values.length && faces.every((face, index) => face === values[index]);
  }
  function animate(duration: number, update: (fraction: number) => void) {
    finish?.();
    const start = performance.now();
    stage.dataset.moving = "true";
    delete stage.dataset.topFaces;
    return new Promise<void>(resolve => {
      finish = () => {
        cancelAnimationFrame(frame);
        finish = undefined;
        update(1);
        draw();
        delete stage.dataset.moving;
        resolve();
      };
      const tick = (now: number) => {
        // RAF shares a timestamp across all callbacks in a frame, including one
        // delivered just before the clock we sampled when starting this throw.
        const fraction = THREE.MathUtils.clamp((now - start) / duration, 0, 1);
        if (fraction >= 1) { finish?.(); return; }
        update(fraction);
        draw();
        frame = requestAnimationFrame(tick);
      };
      tick(start);
    });
  }

  return {
    finish: () => finish?.(),
    roll: async (values: number[], phase?: (phase: "rolling" | "settling") => void, fast = false) => {
      if (!valid(values)) return false;
      finish?.();
      const variation = window.crypto.getRandomValues(new Uint32Array(1))[0];
      const { frames, firstContact } = simulateKqDice(values, variation);
      colors(values, false);
      phase?.("rolling");
      let settling = false;
      await animate((frames.length - 1) / KQ_DICE_HZ * (fast ? 520 : 1160), fraction => {
        const instant = fraction * (frames.length - 1);
        const index = Math.floor(instant);
        const next = frames[Math.min(index + 1, frames.length - 1)];
        if (!settling && index >= firstContact) { settling = true; phase?.("settling"); }
        frames[index].forEach((pose, i) => {
          dice[i].position.lerpVectors(pose.position, next[i].position, instant - index);
          dice[i].quaternion.slerpQuaternions(pose.orientation, next[i].orientation, instant - index);
        });
      });
      return !disposed && check(values);
    },
    sync: async (values: number[], move = true) => {
      if (!valid(values)) return false;
      finish?.();
      if (!move || dice.filter(die => die.visible).length !== values.length) {
        colors(values, false);
        restKqDice(values).forEach(({ position, orientation }, i) => {
          dice[i].position.copy(position); dice[i].quaternion.copy(orientation);
        });
        draw();
      } else {
        const changed = values.flatMap((value, i) => {
          const die = dice[i];
          if (readKqTopFace(die.quaternion).face === value) return [];
          return [{ die, from: die.quaternion.clone(), to: retargetKqDie(die.quaternion, value), base: die.position.y }];
        });
        if (changed.length) await animate(260, t => changed.forEach(({ die, from, to, base }) => {
          die.quaternion.slerpQuaternions(from, to, t * t * (3 - 2 * t));
          die.position.y = base + .25 * Math.sin(Math.PI * t);
        }));
      }
      return !disposed && check(values);
    },
    reveal: (values: number[]) => {
      if (!valid(values) || !check(values)) return false;
      colors(values, true);
      draw();
      return true;
    },
    dispose: () => {
      disposed = true;
      finish?.();
      observer.disconnect();
      geometry.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      dice.forEach(die => die.material.forEach(material => material.dispose()));
      maps.forEach(map => map.dispose());
      key.shadow.dispose();
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

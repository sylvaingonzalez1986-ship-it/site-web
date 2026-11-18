import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { gatherKqDice, KQ_DIE_FACES, KQ_DIE_SIDE, KQ_DICE_HZ, readKqTopFace, restKqDice, retargetKqDie, simulateKqDice } from "@/lib/kanab-quest-dice-physics";

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
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.arc(x, y + 1.2, 12, 0, Math.PI * 2);
    ctx.fill();
    const shade = ctx.createLinearGradient(x - 1, y - 11, x + 2, y + 11);
    shade.addColorStop(0, "#0a1b1b");
    shade.addColorStop(.68, "#20332f");
    shade.addColorStop(1, "#536b60");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x, y, 11.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeContactTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const shade = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
  shade.addColorStop(0, "rgba(16,30,22,.9)");
  shade.addColorStop(.50, "rgba(16,30,22,.55)");
  shade.addColorStop(1, "rgba(16,30,22,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

const valid = (values: number[]) => (values.length === 3 || values.length === 4)
  && values.every(value => Number.isInteger(value) && value > 0 && value < 7);
const tint = (value: number, index: number, validated: boolean) => index === 3 ? 0xb1bcae
  : !validated ? 0xfff4d5 : value === 1 ? 0xf29680 : value === 6 ? 0xf6c552 : value >= 4 ? 0x79d8bc : 0xfffaf0;

export function createKqDiceTable(stage: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, .1, 30);
  camera.position.set(0, 9.8, 5.8);
  camera.lookAt(0, .8, .02);
  scene.add(new THREE.HemisphereLight(0xfffcf0, 0x9eb3a1, 1.35));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
  key.position.set(-2.5, 8, -1.8);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -4.7, right: 4.7, top: 4, bottom: -4, near: .1, far: 16 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = .016;
  scene.add(key, key.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), new THREE.ShadowMaterial({ opacity: .24 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const contactMap = makeContactTexture();
  const contactGeometry = new THREE.PlaneGeometry(1.55, 1.55);
  const contacts = Array.from({ length: 4 }, () => {
    const shadow = new THREE.Mesh(contactGeometry, new THREE.MeshBasicMaterial({ map: contactMap, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);
    return shadow;
  });
  const stroke = new THREE.Shape();
  stroke.moveTo(.34, -.014);
  stroke.quadraticCurveTo(.49, -.06, .81, -.025);
  stroke.quadraticCurveTo(.65, .026, .37, .04);
  stroke.closePath();
  const strokeGeometry = new THREE.ShapeGeometry(stroke).rotateX(-Math.PI / 2);
  const strokeInks = [0xffe8ad, 0xf7c359].map(color =>
    new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  const impact = new THREE.Group();
  [2.2, 2.85, 3.55, 4.15].forEach((angle, i) => {
    const ray = new THREE.Mesh(strokeGeometry, strokeInks[i % 2]);
    ray.rotation.y = angle;
    ray.scale.setScalar([.8, 1, .93, .72][i]);
    impact.add(ray);
  });
  impact.visible = false;
  scene.add(impact);
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
  let finish: ((land?: boolean) => void) | undefined;
  let gatheredVariation: number | undefined;
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    dice.forEach((die, index) => {
      const shadow = contacts[index];
      shadow.visible = die.visible;
      if (!die.visible) return;
      const clearance = Math.max(0, die.position.y - KQ_DIE_SIDE / 2);
      shadow.position.set(die.position.x, .012, die.position.z);
      shadow.scale.setScalar(die.scale.x * (1 + .45 * clearance));
      shadow.material.opacity = .4 / (1 + 3.8 * clearance);
    });
    renderer.render(scene, camera);
  };
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const aspect = width / height;
    const halfHeight = Math.max(1.98, 3.84 / aspect);
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
  function animate(duration: number, update: (fraction: number) => void, gathering = false) {
    finish?.();
    const start = performance.now();
    const motion = gathering ? "gathering" : "moving";
    stage.dataset[motion] = "true";
    delete stage.dataset.topFaces;
    return new Promise<void>(resolve => {
      finish = (land = true) => {
        cancelAnimationFrame(frame);
        finish = undefined;
        if (land) {
          update(1);
          draw();
        }
        delete stage.dataset[motion];
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

  const nextVariation = () => window.crypto.getRandomValues(new Uint32Array(1))[0];
  return {
    finish: () => finish?.(),
    gather: (fast = false) => {
      finish?.();
      gatheredVariation = nextVariation();
      const visible = dice.filter(die => die.visible);
      const targets = gatherKqDice(visible.length, gatheredVariation);
      const side = gatheredVariation % 2 === 0 ? -1 : 1;
      const pickups = visible.map((die, i) => ({
        die, from: die.position.clone(), rotation: die.quaternion.clone(),
        tilted: new THREE.Quaternion().setFromEuler(new THREE.Euler(.26, (i - 1) * .21, side * .49)).multiply(die.quaternion),
      }));
      void animate(fast ? 140 : 280, t => {
        const ease = t * t * (3 - 2 * t);
        pickups.forEach(({ die, from, rotation, tilted }, i) => {
          die.position.lerpVectors(from, targets[i], ease);
          die.position.y += (.23 + i * .1) * Math.sin(Math.PI * t);
          die.quaternion.slerpQuaternions(rotation, tilted, ease);
        });
      }, true);
    },
    roll: async (values: number[], phase?: (phase: "rolling" | "settling") => void, fast = false) => {
      if (!valid(values)) return false;
      // The server may reply on any frame of the pickup. Release from the
      // transforms on screen, even when the hand is only halfway across.
      finish?.(gatheredVariation === undefined);
      const variation = gatheredVariation ?? nextVariation();
      gatheredVariation = undefined;
      const { frames, firstContact, impactPoint } = simulateKqDice(values, variation);
      impact.position.copy(impactPoint);
      impact.position.y = .025;
      impact.rotation.y = variation % 2 === 0 ? 0 : Math.PI;
      const visible = dice.slice(0, 3).filter(die => die.visible);
      const hasPickup = visible.length > 0;
      const starts = frames[0].map((release, i) => {
        const source = i === 3 ? dice[3] : visible.sort((a, b) =>
          a.position.distanceToSquared(release.position) - b.position.distanceToSquared(release.position)).shift();
        const onTable = source?.visible;
        return {
          position: onTable ? source.position.clone() : release.position,
          orientation: onTable ? source.quaternion.clone() : release.orientation,
          scale: !onTable && hasPickup ? 0 : 1,
        };
      });
      colors(values, false);
      phase?.("rolling");
      let settling = false;
      const travel = (frames.length - 1) / KQ_DICE_HZ * (fast ? 520 : 1160);
      const distance = Math.max(...starts.map((start, i) => start.position.distanceTo(frames[0][i].position)));
      const windup = hasPickup ? Math.min(260, 120 + 38 * distance) * (fast ? .5 : 1) : 0;
      const impactTime = windup + firstContact / (frames.length - 1) * travel;
      await animate(windup + travel, fraction => {
        const elapsed = fraction * (windup + travel);
        const inkTime = (elapsed - impactTime) / 200;
        impact.visible = inkTime >= 0 && inkTime < 1 && fraction < 1;
        if (impact.visible) {
          impact.scale.setScalar(.78 + .42 * inkTime);
          strokeInks.forEach(ink => { ink.opacity = 1 - inkTime * inkTime; });
        }
        if (elapsed < windup) {
          const t = elapsed / windup;
          const ease = t * t * (3 - 2 * t);
          starts.forEach((start, i) => {
            const die = dice[i];
            die.position.lerpVectors(start.position, frames[0][i].position, ease);
            die.position.y += .12 * Math.sin(Math.PI * t);
            die.quaternion.slerpQuaternions(start.orientation, frames[0][i].orientation, ease);
            die.scale.setScalar(THREE.MathUtils.lerp(start.scale, 1, ease));
          });
          return;
        }
        const instant = THREE.MathUtils.clamp((elapsed - windup) / travel, 0, 1) * (frames.length - 1);
        const index = Math.floor(instant);
        const next = frames[Math.min(index + 1, frames.length - 1)];
        if (!settling && index >= firstContact) { settling = true; phase?.("settling"); }
        frames[index].forEach((pose, i) => {
          dice[i].scale.setScalar(1);
          dice[i].position.lerpVectors(pose.position, next[i].position, instant - index);
          dice[i].quaternion.slerpQuaternions(pose.orientation, next[i].orientation, instant - index);
        });
      });
      return !disposed && check(values);
    },
    sync: async (values: number[], move = true) => {
      if (!valid(values)) return false;
      finish?.();
      gatheredVariation = undefined;
      if (!move || dice.filter(die => die.visible).length !== values.length) {
        colors(values, false);
        restKqDice(values).forEach(({ position, orientation }, i) => {
          dice[i].position.copy(position); dice[i].quaternion.copy(orientation);
          dice[i].scale.setScalar(1);
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
      contactGeometry.dispose();
      contactMap.dispose();
      contacts.forEach(shadow => shadow.material.dispose());
      strokeGeometry.dispose();
      strokeInks.forEach(ink => ink.dispose());
      dice.forEach(die => die.material.forEach(material => material.dispose()));
      maps.forEach(map => map.dispose());
      key.shadow.dispose();
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

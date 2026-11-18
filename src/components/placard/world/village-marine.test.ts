import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createVillageMarine, sampleFishingCycle, sampleFishingRoute, sampleMarineCoast, sampleVillageWaves, VILLAGE_FISHING_CYCLE_SECONDS, VILLAGE_MARINE_PRESENTATION_OFFSET } from "./village-marine";
import { paintingToGround, VILLAGE_SEA_LEVEL, VILLAGE_SEA_SIZE } from "./village-layout";
import { createVillageMainland, VILLAGE_MAINLAND_SHORE } from "./village-mainland";
import { VILLAGE_SECOND_BANK } from "./village-terrain";
import type { VillageLifeFrame } from "./village-life-types";

const frame=(time:number,overrides:Partial<VillageLifeFrame>={}):VillageLifeFrame=>({time,delta:1/30,reduced:false,quality:"high",visible:()=>true,...overrides});
const pointSegment=(x:number,z:number,a:readonly number[],b:readonly number[])=>{
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
};

describe("village marine motion",()=>{
  it("fits the mainland and its surf inside the water tile and fills the land behind the coast", () => {
    const limit = VILLAGE_SEA_SIZE / 2;
    const mainland = createVillageMainland();
    const marine = createVillageMarine();
    const foam = marine.object.getObjectByName("mainland-contact-foam") as THREE.Mesh;
    for (const geometry of [mainland.geometry, foam.geometry]) {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      for (const axis of ["x", "z"] as const) {
        expect(box.min[axis]).toBeGreaterThanOrEqual(-limit);
        expect(box.max[axis]).toBeLessThanOrEqual(limit);
      }
    }
    expect(VILLAGE_MAINLAND_SHORE[0][0]).toBeCloseTo(-limit);
    expect(VILLAGE_MAINLAND_SHORE.at(-1)![1]).toBeCloseTo(-limit);

    // The production mesh ignores pointer hits. Sample its actual triangles from above.
    const land = new THREE.Mesh(mainland.geometry, mainland.material);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    function expectDryLand(x: number, z: number) {
      ray.ray.origin.set(x, 50, z);
      const [hit] = ray.intersectObject(land, false);
      expect(hit?.point.y, `land at ${x}, ${z}`).toBeGreaterThan(VILLAGE_SEA_LEVEL + .042);
    }
    expectDryLand(-limit + .01, -limit + .01);
    for (let i = 1; i < VILLAGE_MAINLAND_SHORE.length - 1; i += 3) {
      const [x, z] = VILLAGE_MAINLAND_SHORE[i];
      const toEdge = Math.min(x, z) + limit;
      for (const fraction of [.25, .6, .99]) expectDryLand(x - toEdge * fraction, z - toEdge * fraction);
    }
    mainland.geometry.dispose();
    mainland.material.dispose();
    marine.dispose();
  });

  it("keeps the complete hull route clear of the island, lighthouse, second bank and mainland",()=>{
    const coast=sampleMarineCoast();
    const bank=sampleMarineCoast(VILLAGE_SECOND_BANK);
    const lighthouse=paintingToGround(1420,15);
    let coastClearance=Infinity,bankClearance=Infinity,lighthouseClearance=Infinity,mainlandClearance=Infinity;
    for(let i=0;i<=1600;i++) {
      const p=sampleFishingRoute(i/1600);
      for(let j=0;j<coast.length-1;j++) coastClearance=Math.min(coastClearance,pointSegment(p.x,p.z,coast[j],coast[j+1]));
      for(let j=0;j<bank.length-1;j++) bankClearance=Math.min(bankClearance,pointSegment(p.x,p.z,bank[j],bank[j+1]));
      for(let j=0;j<VILLAGE_MAINLAND_SHORE.length-1;j++) mainlandClearance=Math.min(mainlandClearance,pointSegment(p.x,p.z,VILLAGE_MAINLAND_SHORE[j],VILLAGE_MAINLAND_SHORE[j+1]));
      lighthouseClearance=Math.min(lighthouseClearance,Math.hypot(p.x-lighthouse[0],p.z-lighthouse[1]));
    }
    // 1.6 m half hull, ~0.9 m shore rocks, plus an unobstructed water margin.
    expect(coastClearance).toBeGreaterThan(3.2);
    expect(bankClearance).toBeGreaterThan(3.2);
    expect(mainlandClearance).toBeGreaterThan(3.2);
    expect(lighthouseClearance).toBeGreaterThan(5.2);
    const start=sampleFishingRoute(0),end=sampleFishingRoute(1-1e-7);
    expect(Math.hypot(start.x-end.x,start.z-end.z)).toBeLessThan(.001);
    expect(Math.abs(start.heading-end.heading)).toBeLessThan(.001);
  });

  it("decelerates, lowers, fishes, hauls a catch, stows and resumes at all four stops",()=>{
    const phases=[[5,"depart"],[25,"cruise"],[59,"approach"],[66,"lower"],[75,"fishing"],[86,"haul"],[92,"stow"]] as const;
    for(let station=0;station<4;station++) {
      for(const [time,phase] of phases) expect(sampleFishingCycle(station*94+time).phase).toBe(phase);
      const stopped=sampleFishingCycle(station*94+65);
      expect(stopped.speed).toBe(0);
      expect(sampleFishingCycle(station*94+81).progress).toBe(stopped.progress);
      expect(sampleFishingCycle(station*94+75).gearDepth).toBe(1);
      expect(sampleFishingCycle(station*94+86).catchVisible).toBe(true);
      expect(sampleFishingCycle(station*94+93).catchVisible).toBe(true);
    }
    expect(sampleFishingCycle(55).speed).toBeGreaterThan(sampleFishingCycle(61).speed);
    expect(sampleFishingCycle(63.999).speed).toBeLessThan(.00001);
    expect(sampleFishingCycle(94).speed).toBe(0);
    expect(sampleFishingCycle(95).speed).toBeGreaterThan(0);
    expect(sampleFishingCycle(21+VILLAGE_FISHING_CYCLE_SECONDS)).toEqual(sampleFishingCycle(21));
  });

  it("has continuous position and speed at every phase boundary",()=>{
    for(let station=0;station<4;station++) for(const boundary of [10,54,64,69,82,89,94]) {
      const t=station*94+boundary;
      const a=sampleFishingCycle(t-.001),b=sampleFishingCycle(t+.001);
      const pa=sampleFishingRoute(a.progress),pb=sampleFishingRoute(b.progress);
      expect(Math.hypot(pa.x-pb.x,pa.z-pb.z)).toBeLessThan(.003);
      expect(Math.abs(a.speed-b.speed)).toBeLessThan(.001);
      expect(Math.abs(a.gearDepth-b.gearDepth)).toBeLessThan(.002);
    }
  });

  it("uses coherent wave height and derivatives for water, boat and marker buoys",()=>{
    const marine=createVillageMarine();
    for(const time of [0,25,66,86,150,300]) {
      marine.update(frame(time));
      const boat=marine.object.getObjectByName("fishing-boat")!;
      const wave=sampleVillageWaves(boat.position.x,boat.position.z,time);
      expect(boat.position.y).toBeCloseTo(wave.height+.025,8);
      const epsilon=.0001;
      expect(wave.dx).toBeCloseTo((sampleVillageWaves(boat.position.x+epsilon,boat.position.z,time).height-sampleVillageWaves(boat.position.x-epsilon,boat.position.z,time).height)/(epsilon*2),7);
      expect(wave.dz).toBeCloseTo((sampleVillageWaves(boat.position.x,boat.position.z+epsilon,time).height-sampleVillageWaves(boat.position.x,boat.position.z-epsilon,time).height)/(epsilon*2),7);
      const up=new THREE.Vector3(0,1,0).applyEuler(boat.rotation);
      expect(up.distanceTo(new THREE.Vector3(-wave.dx,1,-wave.dz).normalize())).toBeLessThan(.001);
      expect(boat.userData.phase).toBe(sampleFishingCycle(time+VILLAGE_MARINE_PRESENTATION_OFFSET).phase);
      expect(boat.userData.waterHeight).toBe(wave.height);
    }
    const sea=marine.object.getObjectByName("sea-directional-swells") as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
    expect(sea.material.uniforms.uTime.value).toBe(300);
    const buoys=marine.object.getObjectByName("fishing-marker-buoys") as THREE.InstancedMesh;
    const transform=new THREE.Matrix4(),position=new THREE.Vector3();
    for(let i=0;i<buoys.count;i++) {
      buoys.getMatrixAt(i,transform);position.setFromMatrixPosition(transform);
      expect(position.y).toBeCloseTo(sampleVillageWaves(position.x,position.z,300).height,5);
    }
    marine.dispose();
  });

  it("provides a fixed reduced-motion scene, bounded low-quality wake and harmless raycasts",()=>{
    const marine=createVillageMarine(),boat=marine.object.getObjectByName("fishing-boat")!;
    marine.update(frame(2,{quality:"low"}));
    const wake=marine.object.getObjectByName("fishing-boat-wake") as THREE.InstancedMesh;
    expect(wake.count).toBe(12);
    expect(wake.visible).toBe(true);
    marine.update(frame(23)); expect(wake.visible).toBe(false);
    marine.update(frame(90,{reduced:true})); const at=boat.position.clone();
    marine.update(frame(250,{reduced:true})); expect(boat.position.equals(at)).toBe(true);
    expect(wake.visible).toBe(false);
    marine.update(frame(55,{visible:()=>false})); expect(boat.visible).toBe(false);
    marine.object.traverse(child=>{if(child instanceof THREE.Mesh){const hits:THREE.Intersection[]=[]; child.raycast(new THREE.Raycaster(),hits); expect(hits).toEqual([]);}});
    marine.dispose();
  });

  it("shows its first fishing sequence promptly, with a lowered line and a visible stowed catch",()=>{
    const marine=createVillageMarine(),boat=marine.object.getObjectByName("fishing-boat")!;
    const pot=boat.getObjectByName("fishing-pot")!;
    const line=boat.getObjectByName("fishing-line")!;
    const catchFish=boat.getObjectByName("fishing-catch")!;
    const fishingFloat=boat.getObjectByName("fishing-line-contact-float")!;
    marine.update(frame(0)); expect(boat.userData.phase).toBe("approach");
    marine.update(frame(10)); expect(boat.userData.phase).toBe("lower");
    const shortLine=line.scale.y;
    marine.update(frame(15));
    expect(boat.userData.phase).toBe("fishing"); expect(line.visible).toBe(true);
    expect(line.scale.y).toBeGreaterThan(shortLine+1);
    expect(pot.position.y).toBeLessThan(-.5);
    expect(line.position.x).toBeLessThan(-1); expect(pot.position.x).toBeLessThan(-1);
    expect(fishingFloat.visible).toBe(true);
    boat.updateWorldMatrix(true,true);
    const contact=fishingFloat.getWorldPosition(new THREE.Vector3());
    expect(contact.y-sampleVillageWaves(contact.x,contact.z,15).height).toBeCloseTo(.01,3);
    expect(boat.position.x).toBeCloseTo(-12,4); expect(boat.position.z).toBeCloseTo(-15,4);
    marine.update(frame(28.5)); expect(boat.userData.phase).toBe("haul");
    expect(catchFish.visible).toBe(false); expect(catchFish.position.y).toBeLessThan(-.3);
    expect(fishingFloat.visible).toBe(true);
    marine.update(frame(31.5)); expect(catchFish.visible).toBe(true);
    expect(catchFish.position.y).toBeGreaterThan(.10); expect(catchFish.position.x).toBeLessThan(-1);
    expect(fishingFloat.visible).toBe(false);
    marine.update(frame(39.9)); expect(boat.userData.phase).toBe("stow");
    expect(catchFish.visible).toBe(true); expect(catchFish.position.x).toBeLessThan(-.19);
    marine.update(frame(40)); expect(boat.userData.phase).toBe("depart"); expect(catchFish.visible).toBe(false);
    marine.dispose();
  });

  it("joins the line to the tilted boat and pot throughout approach, deployment and stowage", () => {
    const marine = createVillageMarine();
    const boat = marine.object.getObjectByName("fishing-boat")!;
    const line = boat.getObjectByName("fishing-line")!;
    const pot = boat.getObjectByName("fishing-pot")!;
    const lineTop = new THREE.Vector3(), lineBottom = new THREE.Vector3();
    const pulley = new THREE.Vector3(), pottedEnd = new THREE.Vector3();
    for (const time of [3, 9, 15, 29, 36, 39.5]) {
      marine.update(frame(time));
      boat.updateWorldMatrix(true, true);
      line.localToWorld(lineTop.set(0, -.5, 0));
      line.localToWorld(lineBottom.set(0, .5, 0));
      boat.localToWorld(pulley.set(-1.12, 1.29, -.53));
      pot.localToWorld(pottedEnd.set(0, .14, 0));
      expect(line.visible).toBe(true);
      expect(lineTop.distanceTo(pulley)).toBeLessThan(.00001);
      expect(lineBottom.distanceTo(pottedEnd)).toBeLessThan(.00001);
    }
    marine.dispose();
  });

  it("layers translucent shore wash and a speed-dependent wake on the common wave clock", () => {
    const marine = createVillageMarine();
    const foam = marine.object.getObjectByName("shore-eddy-foam") as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const mainland = marine.object.getObjectByName("mainland-contact-foam") as typeof foam;
    const wake = marine.object.getObjectByName("fishing-boat-wake") as THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    expect(foam.material).toBe(mainland.material);
    expect(foam.material.transparent).toBe(true);
    expect(foam.material.depthWrite).toBe(false);
    expect(foam.geometry.getAttribute("coastDistance").count).toBe(foam.geometry.getAttribute("position").count);
    marine.update(frame(66));
    expect(foam.material.uniforms.uTime.value).toBe(66);
    expect(wake.material.uniforms.uTime.value).toBe(66);
    const strength = new THREE.Color();
    expect(wake.visible).toBe(true);
    wake.getColorAt(0, strength);
    const bow = strength.r;
    wake.getColorAt(wake.count - 1, strength);
    expect(bow).toBeGreaterThan(strength.r);
    marine.update(frame(17));
    expect(wake.visible).toBe(false);
    marine.dispose();
  });

  it("releases every owned geometry and material exactly once, including instance buffers",()=>{
    const marine=createVillageMarine();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),instances:THREE.InstancedMesh[]=[];
    marine.object.traverse(child=>{if(child instanceof THREE.Mesh){geometries.add(child.geometry);for(const material of Array.isArray(child.material)?child.material:[child.material])materials.add(material);}if(child instanceof THREE.InstancedMesh)instances.push(child);});
    const released=vi.fn(),instanceReleased=vi.fn();
    for(const geometry of geometries)geometry.addEventListener("dispose",released);
    for(const material of materials)material.addEventListener("dispose",released);
    for(const instance of instances)instance.addEventListener("dispose",instanceReleased);
    marine.dispose(); marine.dispose(); marine.update(frame(40));
    expect(released).toHaveBeenCalledTimes(geometries.size+materials.size);
    expect(instanceReleased).toHaveBeenCalledTimes(instances.length);
    expect(marine.object.children).toHaveLength(0);
    expect(marine.object.userData.disposed).toBe(true);
  });
});

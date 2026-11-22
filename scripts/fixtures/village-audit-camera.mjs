// The isolated Vite viewer wraps the live canvas so a recording can follow a
// moving model through the normal camera rig, independently of the player menu.
export const auditCameraScene = `
  import React from 'react';
  import VillageCanvas from '/src/components/placard/world/VillageCanvas.tsx';

  export default function AuditCameraScene(props) {
    const [shot, setShot] = React.useState(null);
    const request = props.cameraRequest;
    React.useEffect(() => {
      const frame = event => setShot({ source: request, camera: { ...request, zoom: 1, observe: event.detail } });
      window.addEventListener('audit:frame-village-subject', frame);
      return () => window.removeEventListener('audit:frame-village-subject', frame);
    }, [request]);
    return <VillageCanvas {...props} cameraRequest={shot?.source === request ? shot.camera : request} />;
  }
`;

export async function frameVillageSubject(page, subject) {
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('audit:frame-village-subject', { detail: id })), subject);
  await page.waitForSelector(`canvas[data-life-observe="${subject}"][data-camera-transition="idle"]`);
}

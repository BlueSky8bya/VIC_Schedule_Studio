/** Reusable generation input, not a runtime renderer or a generation receipt.
 * Attach the actual readonly design reference and requested pose sheet to the
 * built-in image tool under the VIC illustration workflow. No automatic call. */
export function companionExpressionPrompt({ id, label, referenceSha256 }) {
  if (!/^[a-z][a-z-]{1,30}$/.test(id) || typeof label !== 'string' || !label.trim() || label.length > 80 || !/^[a-f0-9]{64}$/.test(referenceSha256)) throw Error('A named expression and exact inspected reference SHA are required');
  const close = {
    sour: 'The left eye squeezes into a substantial rounded chevron; the right eye keeps a visible pupil.',
    icy: 'Both eyes squeeze into substantial rounded chevrons during the cold reaction.',
    sneeze: 'Both eyes deliberately squeeze before the sneeze, then reopen fully.',
    greeting: 'One eye briefly forms a rounded happy arch; the other retains its open pupil.',
    'tidy-pride': 'One eye forms a confident happy arch; the other keeps a substantial pupil.',
    melt: 'Both eyes settle into rounded happy arches with substantial contour thickness.',
    awake: 'Start from sleepy rounded happy arches, then continuously lift the lids into the normal open eyes.',
    giggle: 'Normal open eyes gradually close into happy arches as the laugh builds.',
    relief: 'Worried open eyes gradually relax and close into happy arches after the surprise.'
  }[id] ?? 'Keep both pupils visible. Express emotion with modest upper-lid angles, gaze and the mouth, preserving the normal eye footprint and depth.';
  return `Create ONE transparent eight-frame expression study for the SAME Biktamin in the supplied original reference. Expression: ${id} (${label}). The inspected identity reference is bound by SHA256 ${referenceSha256}; a checksum is provenance, not proof of visual fidelity.

IDENTITY LOCK: Keep the original layered square-pompom body, two rabbit ears, orange square cheeks, eye spacing, eye width, dark-brown eye contour, highlights and mouth placement. There are no hands or feet. Preserve body volume and the source pose silhouette. Preserve equipped glasses, lens size, bridge and fit in the same face plane. An expression must not shrink the pupils, move the cheeks or inflate the body. Use the same eye construction throughout; eyelids move OVER the eyes rather than scaling the eye artwork vertically.

ACTING: ${close} Eye and mouth acting must communicate this specific reaction rather than a generic repeated smile. Open eyes retain at least roughly four-fifths of their usual aperture; this is an art target, checked after generation. Deliberate closure is allowed only for the described acting, with a clear curved lid contour and visible closing/reopening stages. Do not hold accidental flat slits or change eye style on one isolated frame.

SEQUENCE: Eight equally sized cells in one row, consistent scale, camera, pivot and margins. 1 neutral; 2 anticipation; 3 entering the emotion; 4 clear expression; 5 expressive hold; 6 easing the hold; 7 recovery; 8 the original neutral identity. Adjacent frames must form one planned eyelid path with clean curves, not eight independently redesigned faces. Preserve the body and accessory coordinates while the face acts. Keep both ends compatible for runtime interpolation; do not use crossfaded duplicate eyes or ghost outlines.

DELIVERY: Transparent background, full ears/body visible, generous transparent gutters, no labels, text, props or extra characters. Inspect the entire sequence at actual 72–92px game size and normal speed, then adjacent frames at slow speed. Compare pupil thickness, lid arcs, cheek positions, body outline and glasses to the original; preserve failures as failures. Prompting alone does not guarantee consistency.`;
}

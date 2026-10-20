"""Source-bound geometric registration of the one143 generated eye strip.

No drawing, source erasure or alpha alteration. Every adopted RGB sample comes
from the generated image. Only a subset of the predeclared eye masks is used.
Old runtime files are read only; outputs are new sibling draft files.
"""
from pathlib import Path
import hashlib
import json
import math
import sys

import numpy as np
from PIL import Image

RUN = Path(__file__).resolve().parent.parent
REPO = RUN.parents[4]
OUT = RUN / "정리본"
RECORD = RUN / "제작기록"
NATIVE = RUN / "원본/단일생성_눈정렬143.png"
NATIVE_SHA = "1b1dc2d4abf68a9a5e8125f222ffbe296b7f213f2fb034d970fadbe9972b3acf"
PACKETS = {
    9: ("현재패킷_9.webp", "ff8ecc78933a0bd414e7fefa2e682fa1a04da5760e3985e286731d02bd6b1673", "vitamin-action-09-eye-scale-143-v1"),
    23: ("현재패킷_23.webp", "b2e701cd2e403c402f61126404a6435cdde40e3810584262693605765cac6cda", "vitamin-play-04-eye-scale-143-v1"),
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(name):
    return json.loads((RECORD / name).read_text(encoding="utf-8-sig"))


def parts(array):
    """Same RGBA threshold and8-connected pixel centres as accessory rig."""
    mask = ((array[:, :, 0] < 120) & (array[:, :, 1] < 100)
            & (array[:, :, 2] < 90) & (array[:, :, 3] > 160))
    seen = np.zeros(mask.shape, dtype=bool)
    result = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        queue = [(int(x), int(y))]
        seen[y, x] = True
        points = []
        while queue:
            xx, yy = queue.pop()
            points.append((xx + .5, yy + .5))
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    nx, ny = xx + dx, yy + dy
                    if 0 <= nx < mask.shape[1] and 0 <= ny < mask.shape[0] and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((nx, ny))
        if len(points) < 8:
            continue
        p = np.array(points)
        box = [int(p[:, 0].min()), int(p[:, 1].min()), int(p[:, 0].max()) + 1, int(p[:, 1].max()) + 1]
        if box[2] - box[0] < 25 and box[3] - box[1] < 26:
            result.append({"box": box, "center": p.mean(axis=0).tolist(), "area": len(points)})
    return result


def nearest_pair(array, targets):
    candidates = parts(array)
    pair = [min(candidates, key=lambda p: math.dist(p["center"], t)) for t in targets]
    assert pair[0] is not pair[1]
    assert all(math.dist(p["center"], t) <= 7 for p, t in zip(pair, targets))
    return pair


def packet_cell(array, index):
    return array[index // 8 * 192:(index // 8 + 1) * 192, index % 8 * 192:(index % 8 + 1) * 192]


def metric(pair):
    return {"eyes": pair, "pairSpan": math.dist(*[p["center"] for p in pair]),
            "axisDegrees": math.degrees(math.atan2(pair[1]["center"][1] - pair[0]["center"][1], pair[1]["center"][0] - pair[0]["center"][0]))}


def main():
    check = sys.argv[1:] == ["--check"]
    assert not sys.argv[1:] or check, "Only optional --check is supported"
    assert digest(NATIVE) == NATIVE_SHA
    maps = load("얼굴입력_기계크롭영수증.json")["mapping"]
    masks = load("개별눈마스크_계보.json")["mapping"]
    base = {}
    for atlas, (name, sha, _) in PACKETS.items():
        path = RUN / "고정입력" / name
        assert digest(path) == sha
        base[atlas] = np.array(Image.open(path).convert("RGBA"))
    current = {atlas: array.copy() for atlas, array in base.items()}
    normalized = Image.open(NATIVE).convert("RGBA").resize((256, 192), Image.Resampling.LANCZOS)
    stand = np.array(Image.open(RUN / "고정입력/현재셀_0.png").convert("RGBA"))
    rig = json.loads((REPO / "lib/ui/viewer-companion/accessory-anchors.json").read_text(encoding="utf-8-sig"))
    standing = nearest_pair(stand, [[v * 2.4 for v in eye["center"]] for eye in rig["frames"][0]["eyes"]])
    target_span = metric(standing)["pairSpan"]
    target_width = max(eye["box"][2] - eye["box"][0] for eye in standing)
    report = {"mode": "Draft, source-bound generated RGB registration; no manual drawing", "generatedSha256": NATIVE_SHA,
              "sourceThreshold": {"rBelow": 120, "gBelow": 100, "bBelow": 90, "alphaAbove": 160, "connectivity": 8},
              "normalization": "4x6 grid uniform native1448x1086 to256x192 Lanczos; per-eye isotropic scale and translation from measured generated component to actual source pair axis/midpoint",
              "standing": metric(standing), "targetNativeEyeWidth": target_width, "targetPairSpan": target_span,
              "changedPhysicalFrames": [], "frames": [], "ownerApproval": "NONE", "runtimeAdoption": False}
    mask_sheet = np.zeros((1152, 768), dtype=np.uint8)
    final_sheet = Image.open(RUN / "고정입력/현재눈_24얼굴_부모.png").convert("RGBA")
    for item, ownership in zip(maps, masks):
        physical = item["sourcePhysical"]
        assert physical == ownership["physicalIndex"]
        atlas, index = item["sourceAtlas"], item["sourceCell"]
        src = packet_cell(base[atlas], index)
        mask_path = REPO / ownership["allowedMask"]
        declared = np.array(Image.open(mask_path).convert("L")) == 255
        # Strict subset: orange cheeks are protected even where a rectangular
        # declared eye-neighbourhood touches an orange antialias fringe.
        orange = ((src[:, :, 0].astype(int) > 160) & (src[:, :, 0].astype(int) - src[:, :, 1].astype(int) > 30)
                  & (src[:, :, 1].astype(int) - src[:, :, 2].astype(int) > 8) & (src[:, :, 2] < 175))
        allowed = declared & ~orange
        original_pair = nearest_pair(src, [[v * 2.4 for v in eye["center"]] for eye in rig["frames"][physical]["eyes"]])
        midpoint = np.array([p["center"] for p in original_pair]).mean(axis=0)
        axis = np.array(original_pair[1]["center"]) - np.array(original_pair[0]["center"])
        axis /= np.linalg.norm(axis)
        desired = [midpoint - axis * target_span / 2, midpoint + axis * target_span / 2]
        tx, ty = item["targetX"], item["targetY"]
        tile = normalized.crop((tx, ty, tx + 64, ty + 32))
        crop = item["sourceCrop192"]
        hints = [[p["center"][0] - crop[0], p["center"][1] - crop[1]] for p in original_pair]
        generated_pair = nearest_pair(np.array(tile), hints)
        dst = src.copy()
        transforms = []
        for side, (generated, target, box) in enumerate(zip(generated_pair, desired, ownership["allowedEyeBoxes192"])):
            width = generated["box"][2] - generated["box"][0]
            scale = target_width / width
            cx, cy = generated["center"]
            a, c = 1 / scale, cx - target[0] / scale
            e, f = 1 / scale, cy - target[1] / scale
            sampled = np.array(tile.transform((192, 192), Image.Transform.AFFINE, (a, 0, c, 0, e, f), Image.Resampling.BICUBIC))
            side_mask = allowed.copy()
            side_mask[:box[1]] = False
            side_mask[box[3]:] = False
            side_mask[:, :box[0]] = False
            side_mask[:, box[2]:] = False
            yy, xx = np.where(side_mask)
            assert len(xx) and np.all((xx * a + c >= 0) & (xx * a + c < 64) & (yy * e + f >= 0) & (yy * e + f < 32))
            dst[side_mask, :3] = sampled[side_mask, :3]
            transforms.append({"side": side, "sourceGeneratedEye": generated, "desiredCenter192": target.tolist(), "scale": scale,
                               "affineDestination192ToGenerated64": [a, 0, c, 0, e, f], "adoptedRegionPixels": int(side_mask.sum())})
        changed = np.any(src != dst, axis=2)
        assert not np.any(changed & ~allowed)
        assert np.array_equal(src[:, :, 3], dst[:, :, 3])
        guard = ownership["mouthGuard192"]
        assert np.array_equal(src[guard[1]:guard[3], guard[0]:guard[2]], dst[guard[1]:guard[3], guard[0]:guard[2]])
        assert np.array_equal(src[orange], dst[orange])
        final_pair = nearest_pair(dst, desired)
        packet_cell(current[atlas], index)[:] = dst
        pos = item["targetTile"]
        mask_sheet[pos // 4 * 192:(pos // 4 + 1) * 192, pos % 4 * 192:(pos % 4 + 1) * 192] = allowed.astype(np.uint8) * 255
        final_sheet.paste(Image.fromarray(dst).crop(tuple(crop)), (tx, ty))
        report["changedPhysicalFrames"].append(physical)
        report["frames"].append({"physical": physical, "sourceAtlas": atlas, "sourceCell": index, "before": metric(original_pair),
                                 "after": metric(final_pair), "generatedNormalized": metric(generated_pair), "registration": transforms,
                                 "changedPixels": int(changed.sum()), "adoptionMaskSubsetOfDeclared": True, "alphaExact": True,
                                 "outsideMaskRGBAExact": True, "mouthAnd1pxGuardRGBAExact": True, "orangeCheeksRGBAExact": True})
    assert len(report["changedPhysicalFrames"]) == 24
    report["outputs"] = []
    generated_files = {}
    for atlas, (_, _, name) in PACKETS.items():
        for ext in ["png", "webp"]:
            path = OUT / f"{name}.{ext}"
            im = Image.fromarray(current[atlas])
            if check:
                assert np.array_equal(np.array(Image.open(path).convert("RGBA")), current[atlas])
            else:
                assert not path.exists(), f"Refuse overwrite {path}"
                if ext == "png":
                    im.save(path)
                else:
                    im.save(path, lossless=True, quality=100, method=6, exact=True)
                assert np.array_equal(np.array(Image.open(path).convert("RGBA")), current[atlas]), "RGBA codec conservation failed"
            report["outputs"].append({"path": str(path.relative_to(REPO)), "sha256": digest(path), "bytes": path.stat().st_size,
                                      "size": list(im.size), "exactRGBA": True})
        for index in range(16):
            if atlas == 23 and index < 8:
                assert np.array_equal(packet_cell(base[atlas], index), packet_cell(current[atlas], index))
    outputs = [(OUT / "눈정렬143_24얼굴후보.png", final_sheet), (OUT / "눈정렬143_최종채택마스크.png", Image.fromarray(mask_sheet))]
    for path, im in outputs:
        if check:
            assert Image.open(path).tobytes() == im.tobytes()
        else:
            assert not path.exists()
            im.save(path)
    report["protected"] = {"oldRuntimePacketsOverwritten": False, "oldMetadataChanged": False, "alphaAllPixelsExact": True,
                           "outsideEyeRGBAExact": True, "mouthGuard24Exact": True, "quarter368To375Exact": True,
                           "other496PhysicalFramesNotReplaced": True}
    report["unverified"] = ["actual runtime/native sprite display", "all other515 visible eyes normalized", "independent art approval", "glasses integration"]
    path = RECORD / "눈143_기계등록계측.json"
    if check:
        assert json.loads(path.read_text(encoding="utf-8-sig")) == report
    else:
        with path.open("x", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
    print(json.dumps({"status": "CHECK_EXACT" if check else "NEW_DRAFT_DERIVED", "changedFrames": 24,
                      "targetSpan": target_span, "targetWidth": target_width,
                      "afterSpanRange": [min(f["after"]["pairSpan"] for f in report["frames"]), max(f["after"]["pairSpan"] for f in report["frames"])],
                      "preserved": report["protected"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()

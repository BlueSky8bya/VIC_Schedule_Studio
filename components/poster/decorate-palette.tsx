import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Upload } from "lucide-react";
import {
  STICKER_ASSET_KINDS,
  STICKER_SHAPES,
  type StickerAsset,
  type StickerAssetKind
} from "@/lib/domain/schedule-types";
import { ShapeSvg } from "@/components/poster/sticker-shapes";
import { hapticTick } from "@/lib/ui/haptics";

// 꾸미기 팔레트(기본 이모지 · 내 이모지(업로드/삭제) · 도형) — 시청자(공개 포스터)는 안 보는
// 꾸미기 전용 조각. 모놀리식 public-poster에서 분리(추후 툴바 통째 지연 로드 대비). 동작은 동일하게
// 핸들러·상태를 prop으로 받고, 상수(STICKER_SHAPES)·아이콘(ShapeSvg/Upload)은 직접 import한다.
export type EmojiCategory = { key: string; label: string; emojis: string[] };
export type AssetTabKey = "all" | StickerAssetKind;

const ASSET_TABS: { key: AssetTabKey; label: string }[] = [
  { key: "all", label: "전체" },
  ...STICKER_ASSET_KINDS
];

export function DecoratePalette({
  categories,
  emojiCat,
  onEmojiCat,
  activeEmojis,
  onAddEmoji,
  assets,
  assetTab,
  onAssetTab,
  pendingAssetIds,
  onAddImageSticker,
  onRemoveAsset,
  onReorderAssets,
  onSetAssetKind,
  canManageAssets,
  canDeleteAssets,
  canUpload,
  dragOver,
  onDragOver,
  uploading,
  onUploadFiles,
  fileInputRef,
  onAddShape
}: {
  categories: EmojiCategory[];
  emojiCat: string;
  onEmojiCat: (key: string) => void;
  activeEmojis: string[];
  onAddEmoji: (emoji: string) => void;
  assets: StickerAsset[];
  assetTab: AssetTabKey;
  onAssetTab: (key: AssetTabKey) => void;
  pendingAssetIds: Set<string>;
  onAddImageSticker: (asset: StickerAsset) => void;
  onRemoveAsset: (id: string) => void;
  onReorderAssets: (orderedIds: string[]) => void;
  onSetAssetKind: (id: string, kind: StickerAssetKind) => void;
  canManageAssets: boolean;
  canDeleteAssets: boolean;
  canUpload: boolean;
  dragOver: boolean;
  onDragOver: (v: boolean) => void;
  uploading: boolean;
  onUploadFiles: (files: File[]) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAddShape: (key: string) => void;
}) {
  // 보관함 드래그: 칩끼리 끌면 순서 바꾸기, 분류 탭 위에 놓으면 그 분류로 옮기기.
  // 클릭(=스티커 추가)과 구분하려고 5px 임계값을 넘겨야 드래그로 친다.
  //
  // 주의 — 포인터 캡처를 걸면 뒤따르는 click이 '캡처한 요소'(칩 래퍼 div)로 리타겟된다.
  // 그래서 안쪽 <button>의 onClick은 아예 오지 않는다(브라우저 실측 확인). 캡처는 관리 권한이
  // 있을 때만 걸리므로, 관리자가 업로드한 이모지를 눌러도 달력에 안 올라가던 원인이 이것이다.
  // → 캡처를 건 경우엔 '드래그가 아니었던 pointerup'에서 직접 추가한다(click에 의존하지 않는다).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [dropTab, setDropTab] = useState<StickerAssetKind | null>(null);
  const startRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const draggingRef = useRef(false);
  const clickBlockedRef = useRef(false);
  const addedByPointerRef = useRef(false);

  const shown = assetTab === "all" ? assets : assets.filter((a) => a.kind === assetTab);
  const countOf = (key: AssetTabKey) =>
    key === "all" ? assets.length : assets.filter((a) => a.kind === key).length;

  function resetDrag() {
    startRef.current = null;
    draggingRef.current = false;
    setDragId(null);
    setDropId(null);
    setDropTab(null);
  }

  function onChipPointerDown(e: ReactPointerEvent<HTMLDivElement>, asset: StickerAsset) {
    // 지난 조작에서 남았을 수 있는 표식을 새 조작 시작 때 지운다(한 번 눌러도 안 먹는 일 방지).
    clickBlockedRef.current = false;
    addedByPointerRef.current = false;
    // 삭제(×)는 캡처를 걸지 않는다 — 걸면 click이 래퍼로 리타겟돼 삭제 버튼이 안 눌린다.
    if ((e.target as HTMLElement).closest(".asset-del")) {
      return;
    }
    // 업로드 중(임시 id)이거나 권한이 없으면 드래그하지 않는다(이땐 캡처가 없어 click이 정상 동작).
    if (!canManageAssets || pendingAssetIds.has(asset.id) || e.button !== 0) {
      return;
    }
    startRef.current = { x: e.clientX, y: e.clientY, id: asset.id };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onChipPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start) {
      return;
    }
    if (!draggingRef.current) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) {
        return;
      }
      draggingRef.current = true;
      clickBlockedRef.current = true;
      setDragId(start.id);
      hapticTick(); // 집었다는 손맛
    }
    // 포인터 캡처 중이라 이벤트는 칩에만 오므로, 실제로 어느 요소 위인지는 좌표로 찾는다.
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const overChip = under?.closest<HTMLElement>("[data-asset-id]");
    const overTab = under?.closest<HTMLElement>("[data-asset-tab]");
    const tabKey = overTab?.dataset.assetTab;
    if (overChip && overChip.dataset.assetId !== start.id) {
      setDropId(overChip.dataset.assetId ?? null);
      setDropTab(null);
    } else if (tabKey && tabKey !== "all") {
      setDropId(null);
      setDropTab(tabKey as StickerAssetKind);
    } else {
      setDropId(null);
      setDropTab(null);
    }
  }

  function onChipPointerUp() {
    const start = startRef.current;
    if (!start) {
      resetDrag();
      return;
    }
    // 캡처를 걸었지만 끌지는 않았다 = 그냥 누른 것 → 여기서 추가한다(click은 오지 않는다).
    if (!draggingRef.current) {
      const asset = assets.find((a) => a.id === start.id);
      resetDrag();
      if (asset) {
        addedByPointerRef.current = true;
        onAddImageSticker(asset);
      }
      return;
    }
    if (dropTab) {
      const moved = assets.find((a) => a.id === start.id);
      if (moved && moved.kind !== dropTab) {
        onSetAssetKind(start.id, dropTab);
      }
    } else if (dropId && dropId !== start.id) {
      const next = [...assets];
      const from = next.findIndex((a) => a.id === start.id);
      const to = next.findIndex((a) => a.id === dropId);
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onReorderAssets(next.map((a) => a.id));
      }
    }
    resetDrag();
  }

  return (
    <div className="decorate-cols">
      <div className="palette-group">
        <span className="palette-label">기본 이모지</span>
        <div className="emoji-tabs" role="tablist" aria-label="이모지 분류">
          {categories.map((cat) => (
            <button
              aria-pressed={emojiCat === cat.key}
              className={emojiCat === cat.key ? "active" : ""}
              key={cat.key}
              onClick={() => onEmojiCat(cat.key)}
              type="button"
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="emoji-palette">
          {activeEmojis.map((emoji, i) => (
            <button
              className="emoji-chip"
              key={`${emoji}-${i}`}
              onClick={() => onAddEmoji(emoji)}
              title={`${emoji} 추가`}
              type="button"
             data-act="emoji-chip">
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="palette-group">
        <span className="palette-label">내 이모지</span>

        {/* 분류 탭 — 아바타 / 이모티콘(정적) / 움직이는 이모티콘(동적). 칩을 탭 위로 끌면 그 칸으로 옮겨진다. */}
        {assets.length > 0 ? (
          <div className="emoji-tabs asset-tabs" role="tablist" aria-label="내 이모지 분류">
            {ASSET_TABS.map((tab) => (
              <button
                aria-pressed={assetTab === tab.key}
                className={`${assetTab === tab.key ? "active" : ""}${
                  dropTab === tab.key ? " drop-tab" : ""
                }`}
                data-asset-tab={tab.key}
                key={tab.key}
                onClick={() => {
                  hapticTick();
                  onAssetTab(tab.key);
                }}
                type="button"
              >
                {tab.label} <i>{countOf(tab.key)}</i>
              </button>
            ))}
          </div>
        ) : null}

        {/* 저장 칸: 업로드해 둔 이모지 보관함 (드래그로 순서 변경) */}
        {shown.length > 0 ? (
          <div className="emoji-palette asset-palette">
            {shown.map((asset) => {
              const pending = pendingAssetIds.has(asset.id);
              return (
                <div
                  className={`asset-chip ${pending ? "uploading" : ""}${
                    dragId === asset.id ? " dragging" : ""
                  }${dropId === asset.id ? " drop-here" : ""}`}
                  data-asset-id={asset.id}
                  key={asset.id}
                  onPointerCancel={resetDrag}
                  onPointerDown={(e) => onChipPointerDown(e, asset)}
                  onPointerMove={onChipPointerMove}
                  onPointerUp={onChipPointerUp}
                >
                  <button
                    className="emoji-chip"
                    disabled={pending}
                    onClick={() => {
                      // 포인터로 이미 추가했으면(캡처 경로) 두 번 넣지 않는다 — 캡처 중 click을
                      // 버튼까지 전달하는 브라우저가 있어도 안전하게. 키보드(Enter)는 여기로 온다.
                      if (addedByPointerRef.current) {
                        addedByPointerRef.current = false;
                        return;
                      }
                      // 방금 드래그였다면 클릭(=스티커 추가)으로 치지 않는다.
                      if (clickBlockedRef.current) {
                        clickBlockedRef.current = false;
                        return;
                      }
                      onAddImageSticker(asset);
                    }}
                    title={
                      pending
                        ? "올리는 중…"
                        : canManageAssets
                          ? `${asset.name} 추가 (끌어서 순서 변경 · 탭 위에 놓으면 분류 이동)`
                          : `${asset.name} 추가`
                    }
                    type="button"
                   data-act="emoji-chip">
                    {/* 업로드 이미지 미리보기 — 동적 URL이라 next/image 부적합 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={asset.name} draggable={false} src={asset.fileUrl} />
                    {pending ? <span className="asset-spinner" aria-hidden="true" /> : null}
                  </button>
                  {/* 삭제(×)는 에셋 관리 권한이 있을 때만 — 매니저는 꾸미기만(삭제 불가). */}
                  {!pending && canDeleteAssets ? (
                    <button
                      aria-label={`${asset.name} 삭제`}
                      className="asset-del"
                      onClick={() => onRemoveAsset(asset.id)}
                      title="이 이모지 삭제"
                      type="button"
                     data-act="이 이모지 삭제">
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : assets.length > 0 ? (
          <p className="asset-empty">
            이 칸은 비어 있어요. 다른 칸의 이모지를 이 탭 위로 끌어다 놓으면 옮겨져요.
          </p>
        ) : null}

        {/* 업로드 칸 — 에셋 관리 권한이 있을 때만(매니저는 숨김 = 꾸미기만). 드래그앤드롭/클릭. */}
        {canUpload ? (
          <label
            className={`upload-drop ${dragOver ? "dragover" : ""} ${uploading ? "busy" : ""}`}
            onDragLeave={() => onDragOver(false)}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragOver) onDragOver(true);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDragOver(false);
              void onUploadFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              accept="image/png,image/webp,image/gif,image/jpeg"
              disabled={uploading}
              hidden
              multiple
              onChange={(e) => {
                void onUploadFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
            <span className="upload-drop-icon" aria-hidden="true">
              <Upload size={20} />
            </span>
            <span className="upload-drop-title">
              {uploading
                ? "올리는 중…"
                : dragOver
                  ? "여기에 놓으면 업로드돼요"
                  : "이미지를 끌어다 놓거나 클릭해서 업로드"}
            </span>
            <span className="upload-drop-hint">
              정사각형 · 투명 배경 PNG 권장 · PNG·WebP·GIF·JPG · 2MB 이하 · 여러 개 가능
            </span>
          </label>
        ) : null}
      </div>

      {/* P2: 데코 도형 — 누르면 프리셋 색으로 올라가고, 툴바에서 색·움직임·회전 등 조절. */}
      <div className="palette-group">
        <span className="palette-label">도형</span>
        <div className="emoji-palette shape-palette">
          {STICKER_SHAPES.map((s) => (
            <button
              className="emoji-chip shape-chip"
              key={s.key}
              onClick={() => onAddShape(s.key)}
              title={`${s.label} 추가`}
              type="button"
             data-act="emoji-chip">
              <ShapeSvg color={s.defaultColor} shapeKey={s.key} style={{ width: "74%", height: "74%" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

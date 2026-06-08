import type { RefObject } from "react";
import { Upload } from "lucide-react";
import { STICKER_SHAPES, type StickerAsset } from "@/lib/domain/schedule-types";
import { ShapeSvg } from "@/components/poster/sticker-shapes";

// 꾸미기 팔레트(기본 이모지 · 내 이모지(업로드/삭제) · 도형) — 시청자(공개 포스터)는 안 보는
// 꾸미기 전용 조각. 모놀리식 public-poster에서 분리(추후 툴바 통째 지연 로드 대비). 동작은 동일하게
// 핸들러·상태를 prop으로 받고, 상수(STICKER_SHAPES)·아이콘(ShapeSvg/Upload)은 직접 import한다.
export type EmojiCategory = { key: string; label: string; emojis: string[] };

export function DecoratePalette({
  categories,
  emojiCat,
  onEmojiCat,
  activeEmojis,
  onAddEmoji,
  assets,
  pendingAssetIds,
  onAddImageSticker,
  onRemoveAsset,
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
  pendingAssetIds: Set<string>;
  onAddImageSticker: (asset: StickerAsset) => void;
  onRemoveAsset: (id: string) => void;
  canDeleteAssets: boolean;
  canUpload: boolean;
  dragOver: boolean;
  onDragOver: (v: boolean) => void;
  uploading: boolean;
  onUploadFiles: (files: File[]) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAddShape: (key: string) => void;
}) {
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
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="palette-group">
        <span className="palette-label">내 이모지</span>

        {/* 저장 칸: 업로드해 둔 이모지 보관함 */}
        {assets.length > 0 ? (
          <div className="emoji-palette asset-palette">
            {assets.map((asset) => {
              const pending = pendingAssetIds.has(asset.id);
              return (
                <div className={`asset-chip ${pending ? "uploading" : ""}`} key={asset.id}>
                  <button
                    className="emoji-chip"
                    disabled={pending}
                    onClick={() => onAddImageSticker(asset)}
                    title={pending ? "올리는 중…" : `${asset.name} 추가`}
                    type="button"
                  >
                    {/* 업로드 이미지 미리보기 — 동적 URL이라 next/image 부적합 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={asset.name} src={asset.fileUrl} />
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
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
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
            >
              <ShapeSvg color={s.defaultColor} shapeKey={s.key} style={{ width: "74%", height: "74%" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

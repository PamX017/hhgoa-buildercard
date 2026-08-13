'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { renderCard, canvasToBlob, downloadBlob, CANVAS_W, CANVAS_H } from './lib/canvas-utils';

// ============================================================
// CONSTANTS
// ============================================================

const ROLES = ['All Rounder', 'Builder', 'Data', 'Designer', 'Developer', 'AI Engineer'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const FRAME_SRC = '/hh-goa-frame-FINAL.png';

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function HomePage() {
  // --- State ---
  const [builderId, setBuilderId] = useState(null);
  const [builderIdLoading, setBuilderIdLoading] = useState(true);

  const [userImage, setUserImage] = useState(null); // HTMLImageElement
  const [cropState, setCropState] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const [frameImage, setFrameImage] = useState(null);
  const [frameLoading, setFrameLoading] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [heicConverting, setHeicConverting] = useState(false);
  const [sharing, setSharing] = useState(false);

  // --- Refs ---
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const cropContainerRef = useRef(null);

  // Drag/pinch state refs (avoid re-renders during gestures)
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startOffX: 0, startOffY: 0 });
  const pinchRef = useRef({ pinching: false, startDist: 0, startScale: 1 });

  // ============================================================
  // WAIT FOR FONTS & LOAD FRAME IMAGE ON MOUNT
  // ============================================================

  useEffect(() => {
    // Force a re-render when custom fonts are fully loaded by the browser
    if (document.fonts) {
      document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    } else {
      setFontsLoaded(true);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setFrameImage(img);
      setFrameLoading(false);
    };
    img.onerror = () => setFrameLoading(false);
    img.src = FRAME_SRC;
  }, []);

  // ============================================================
  // FETCH BUILDER ID ON MOUNT
  // ============================================================

  useEffect(() => {
    async function fetchBuilderId() {
      try {
        const res = await fetch('/api/builder-id', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setBuilderId(data.builderId);
        } else {
          // Fallback: generate client-side if API isn't configured yet
          const id = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
          setBuilderId(`#HH-GOA-${id}`);
        }
      } catch {
        const id = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        setBuilderId(`#HH-GOA-${id}`);
      }
      setBuilderIdLoading(false);
    }
    fetchBuilderId();
  }, []);

  // ============================================================
  // RE-RENDER CANVAS on state changes
  // ============================================================

  useEffect(() => {
    if (!canvasRef.current || frameLoading) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    renderCard(ctx, {
      userImage,
      cropState,
      frameImage,
      name,
      role,
      builderId: builderId || '',
    });
  }, [userImage, cropState, frameImage, name, role, builderId, frameLoading, fontsLoaded]);

  // ============================================================
  // PHOTO UPLOAD HANDLER
  // ============================================================

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      alert('Photo must be under 10MB');
      return;
    }

    // Validate type
    const type = file.type.toLowerCase();
    const ext = file.name.toLowerCase().split('.').pop();
    const isHeic = type === 'image/heic' || type === 'image/heif' || ext === 'heic' || ext === 'heif';

    if (!isHeic && !ACCEPTED_TYPES.includes(type)) {
      alert('Please upload a JPG, PNG, WEBP, or HEIC image');
      return;
    }

    let imageBlob = file;

    // Convert HEIC if needed
    if (isHeic) {
      setHeicConverting(true);
      try {
        const heic2any = (await import('heic2any')).default;
        const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        imageBlob = Array.isArray(result) ? result[0] : result;
      } catch (err) {
        console.error('HEIC conversion failed:', err);
        alert('Could not convert HEIC photo. Please try a JPG or PNG instead.');
        setHeicConverting(false);
        return;
      }
      setHeicConverting(false);
    }

    // Load into Image element
    const url = URL.createObjectURL(imageBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setUserImage(img);
      setCropState({ scale: 1, offsetX: 0, offsetY: 0 });
    };
    img.src = url;
  }, []);

  const onFileInputChange = (e) => {
    handleFileSelect(e.target.files?.[0]);
    e.target.value = ''; // Reset so same file can be re-selected
  };

  // ============================================================
  // DRAG & DROP
  // ============================================================

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  // ============================================================
  // CROP: PAN (drag) + ZOOM (slider & pinch)
  // ============================================================

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return;
    const el = cropContainerRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);

    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffX: cropState.offsetX,
      startOffY: cropState.offsetY,
    };
  }, [cropState.offsetX, cropState.offsetY]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const { startX, startY, startOffX, startOffY } = dragRef.current;

    // Scale the pixel delta to canvas coordinates
    const el = cropContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scaleFactorX = (CANVAS_W * 0.59) / rect.width; // cutout width ratio
    const scaleFactorY = (CANVAS_H * 0.24) / rect.height;

    const dx = (e.clientX - startX) * scaleFactorX;
    const dy = (e.clientY - startY) * scaleFactorY;

    setCropState((prev) => ({
      ...prev,
      offsetX: startOffX + dx,
      offsetY: startOffY + dy,
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  // Pinch-to-zoom
  const touchesRef = useRef([]);

  const onTouchStart = useCallback((e) => {
    touchesRef.current = [...e.touches];
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      pinchRef.current = { pinching: true, startDist: dist, startScale: cropState.scale };
    }
  }, [cropState.scale]);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.pinching) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const ratio = dist / pinchRef.current.startDist;
      const newScale = Math.max(1, Math.min(5, pinchRef.current.startScale * ratio));
      setCropState((prev) => ({ ...prev, scale: newScale }));
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    pinchRef.current.pinching = false;
  }, []);

  const onZoomSliderChange = (e) => {
    setCropState((prev) => ({ ...prev, scale: parseFloat(e.target.value) }));
  };

  // ============================================================
  // DOWNLOAD
  // ============================================================

  const isReady = userImage && name.trim() && role;

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current || !isReady) return;
    try {
      const blob = await canvasToBlob(canvasRef.current);
      downloadBlob(blob, 'hh-goa-builder-id.png');
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed — please try again.');
    }
  }, [isReady]);

  // ============================================================
  // SHARE TO X
  // ============================================================

  const handleShare = useCallback(() => {
    if (!isReady) return;

    const tweetText = `Just built my Builder ID for Hacker House Goa 2026 🌴\n\nGet yours → hhgoa-buildercard.vercel.app\n\n#FrameInGoa #HackerHouseGoa`;
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  }, [isReady]);

  // ============================================================
  // VALIDATION HINT
  // ============================================================

  const getValidationHint = () => {
    if (!userImage) return 'Upload a photo to get started';
    if (!name.trim()) return 'Enter your name';
    if (!role) return 'Select your role';
    return '';
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <div className="page-bg" />

      {/* ===== HEADER ===== */}
      <header className="main-header">
        <div className="header-left">
          <img src="/palmtree.png" alt="Palm Tree" className="header-palm" />
          <img 
            src="/hackerhousegoa.png" 
            alt="Hacker House Goa" 
            className="header-logo" 
            onClick={() => window.location.reload()}
            style={{ cursor: 'pointer' }}
          />
        </div>
        
        {/* We can add SVG waves, sparkles, or sailboats here later if needed */}
        <div className="header-center"></div>

        <div className="header-right">
          <div className="header-studio-box">
            <img src="/2.47logo.png" alt="2:47 PM Studio" className="header-studio-logo" />
          </div>
        </div>
      </header>

      <main className="main-container" style={{ marginTop: '96px' }}>
        {/* ===== PREVIEW SECTION ===== */}
        <section className="preview-section panel">
          <div className="panel-header">
            <div>
              <div className="panel-label">Preview</div>
              <div className="panel-title">Builder ID</div>
            </div>
            <div className="panel-status">
              <span className="status-dot" />
              Live
            </div>
          </div>
          
          <div className="preview-wrapper">
            {frameLoading ? (
              <div className="skeleton-card">
                <div className="skeleton-spinner" />
                <span className="skeleton-text">Loading frame...</span>
              </div>
            ) : (
              <div className="canvas-container">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                />
              </div>
            )}
            <p className="preview-hint">
              {userImage ? 'Looking good! Adjust your photo and details below.' : 'Add a photo to personalize'}
            </p>
          </div>
        </section>

        {/* ===== FORM SECTION ===== */}
        <section className="form-section panel">
          <div className="panel-header">
            <div>
              <div className="panel-label">Create</div>
              <div className="panel-title">Your Builder Pass</div>
            </div>
          </div>

          <div className="form-section">
            {/* Builder ID */}
            <div className="builder-id-box">
              <span className="builder-id-label">Builder ID</span>
              <span className="builder-id-value">
                {builderIdLoading ? '...' : builderId}
              </span>
            </div>

            {/* Photo upload */}
            <div className="field-group">
              <label className="field-label">
                Photo <span className="required">*</span>
              </label>

              <div className="photo-upload-zone">
                {!userImage ? (
                  <div
                    className="photo-empty-state"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    role="button"
                    tabIndex={0}
                  >
                    {heicConverting ? (
                      <div>
                        <div className="skeleton-spinner" style={{ margin: '0 auto' }} />
                        <span style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>Converting...</span>
                      </div>
                    ) : (
                      <>
                        <div className="upload-icon">↑</div>
                        <div className="upload-text">Click or drop photo</div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      className="crop-container"
                      ref={cropContainerRef}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                      onTouchStart={onTouchStart}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onTouchEnd}
                    >
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        transform: `translate(${(cropState.offsetX / (2046 * 0.59)) * 100}%, ${(cropState.offsetY / (3076 * 0.24)) * 100}%) scale(${cropState.scale})`
                      }}>
                        <img
                          src={userImage.src}
                          alt="Your photo"
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: (userImage.naturalWidth / userImage.naturalHeight) > 1.63 ? 'auto' : '100%',
                            height: (userImage.naturalWidth / userImage.naturalHeight) > 1.63 ? '100%' : 'auto',
                            minWidth: '100%',
                            minHeight: '100%',
                            pointerEvents: 'none'
                          }}
                        />
                      </div>
                    </div>
                    <div className="crop-controls">
                      <label>Zoom</label>
                      <input
                        type="range"
                        className="zoom-slider"
                        min="1"
                        max="3"
                        step="0.05"
                        value={cropState.scale}
                        onChange={onZoomSliderChange}
                      />
                      <button
                        className="change-photo-btn"
                        onClick={() => {
                          setUserImage(null);
                          setCropState({ scale: 1, offsetX: 0, offsetY: 0 });
                        }}
                      >
                        Change
                      </button>
                    </div>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                onChange={onFileInputChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Name */}
            <div className="field-group">
              <label className="field-label" htmlFor="name-input">
                Name <span className="required">*</span>
              </label>
              <input
                id="name-input"
                type="text"
                className="field-input"
                placeholder="Pranav Shewale"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                autoComplete="name"
              />
            </div>

            {/* Role */}
            <div className="field-group">
              <label className="field-label" htmlFor="role-select">
                Role <span className="required">*</span>
              </label>
              <select
                id="role-select"
                className="field-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="" disabled>Select your role</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="action-buttons">
              <button
                className="btn btn-download"
                onClick={handleDownload}
                disabled={!isReady}
              >
                ↓ Download
              </button>
              <button
                className="btn btn-share"
                onClick={handleShare}
                disabled={!isReady || sharing}
              >
                {sharing ? 'Uploading...' : '𝕏 Share on X'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getTouchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

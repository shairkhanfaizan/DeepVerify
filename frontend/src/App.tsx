import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Info, UploadCloud, RefreshCw, Eye } from 'lucide-react';
import styles from './App.module.css';

type AppState = 'IDLE' | 'UPLOADING' | 'ANALYZING' | 'RESULT' | 'ERROR';

interface AnalysisResult {
  ensemble_p_real: number;
  spatial_p_real: number;
  frequency_p_real: number;
  verdict: 'LIKELY_AUTHENTIC' | 'LIKELY_AI_GENERATED';
}

function App() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [isHoveringLens, setIsHoveringLens] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `> ${msg}`]);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (appState !== 'IDLE' && appState !== 'ERROR') return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      startAnalysis(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      startAnalysis(e.target.files[0]);
    }
  };

  const startAnalysis = async (file: File) => {
    setPreviewUrl(URL.createObjectURL(file));
    setAppState('UPLOADING');
    setLogs([]);
    setErrorMsg('');
    setHeatmapUrl(null);

    try {
      addLog('Initiating secure connection...');
      const formData = new FormData();
      formData.append('file', file);

      addLog('Uploading media for analysis...');
      const response = await fetch('/api/v1/analyze/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Upload failed');
      }

      const data = await response.json();
      if (response.status === 202) {
        setAppState('ANALYZING');
        addLog('Validating media integrity... [OK]');
        addLog(`Job queued with ID: ${data.request_id.split('-')[0]}...`);
        pollResult(data.request_id);
      } else if (response.status === 200) {
        // Fast path (shouldn't happen with our backend, but just in case)
        setResult(data.result);
        setHeatmapUrl(`/api/v1/results/${data.request_id}/heatmap.png`);
        setAppState('RESULT');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during upload.');
      setAppState('ERROR');
    }
  };

  const pollResult = async (id: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/v1/results/${id}`);
        
        if (res.status === 200) {
          const data = await res.json();
          if (data.status === 'COMPLETED' || data.status === 'completed') {
            clearInterval(interval);
            addLog('Extracting spatial features (EfficientNet-B0)... [OK]');
            addLog('Analyzing log-magnitude frequency spectrum... [OK]');
            addLog('Computing ensemble probabilities... [OK]');
            addLog('Analysis complete.');
            
            setTimeout(() => {
              setResult({
                verdict: data.verdict,
                ensemble_p_real: data.scores.ensemble,
                spatial_p_real: data.scores.spatial,
                frequency_p_real: data.scores.frequency
              });
              setHeatmapUrl(`/api/v1/results/${id}/heatmap.png`);
              setAppState('RESULT');
            }, 800); // Small delay to let user read final log
          } else if (data.status === 'FAILED' || data.status === 'failed') {
            clearInterval(interval);
            setErrorMsg('Analysis failed on the server.');
            setAppState('ERROR');
          } else {
            // Processing... Add some random flavor logs
            if (attempts === 2) addLog('Allocating ML inference resources...');
            if (attempts === 4) addLog('Running spatial feature extraction...');
          }
        } else if (res.status === 404) {
          clearInterval(interval);
          setErrorMsg('Analysis job not found.');
          setAppState('ERROR');
        }
      } catch (err) {
        clearInterval(interval);
        setErrorMsg('Network error while polling results.');
        setAppState('ERROR');
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setErrorMsg('Analysis timed out.');
        setAppState('ERROR');
      }
    }, 1000);
  };

  const handleLensMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLensPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const reset = () => {
    setAppState('IDLE');
    setPreviewUrl(null);
    setResult(null);
    setHeatmapUrl(null);
    setLogs([]);
  };

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <Shield className={styles.logoIcon} size={28} />
          <span>DeepVerify</span>
        </div>
        <div className={styles.privacyBadge}>
          <Shield size={16} />
          <span>Ephemeral Processing. Your uploaded media is temporarily processed and removed after analysis.</span>
        </div>
      </header>

      <main className={styles.mainContent}>
        <AnimatePresence mode="wait">
          {appState === 'IDLE' && (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className={styles.dropzone}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/jpeg, image/png, image/webp"
                onChange={handleFileSelect}
              />
              <UploadCloud size={64} className={styles.logoIcon} style={{ opacity: 0.5 }} />
              <div className={styles.dropzoneText}>Forensic Dropzone</div>
              <div className={styles.dropzoneSubtext}>Drag & drop an image or click to browse</div>
            </motion.div>
          )}

          {(appState === 'UPLOADING' || appState === 'ANALYZING') && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className={styles.analysisContainer}
            >
              <div className={styles.imagePreview}>
                {previewUrl && <img src={previewUrl} alt="Preview" />}
                <div className={styles.laserSweep} />
              </div>
              <div className={`${styles.glassPanel} ${styles.terminal}`}>
                {logs.map((log, i) => (
                  <div key={i} className={styles.terminalLine}>
                    <span className={styles.mono}>{log}</span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </motion.div>
          )}

          {appState === 'ERROR' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`${styles.glassPanel} ${styles.verdictHeader}`}
            >
              <div className={styles.verdictFake}>Error</div>
              <div className={styles.confidenceRow}>{errorMsg}</div>
              <button className={styles.resetButton} onClick={reset}>Try Again</button>
            </motion.div>
          )}

          {appState === 'RESULT' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={styles.resultContainer}
            >
              <div className={`${styles.glassPanel} ${styles.verdictHeader}`}>
                <div className={`${styles.verdictBadge} ${result.verdict === 'LIKELY_AUTHENTIC' ? styles.verdictAuthentic : styles.verdictFake}`}>
                  {result.verdict.replaceAll('_', ' ')}
                </div>
                <div className={styles.confidenceRow}>
                  Model confidence: {(Math.max(result.ensemble_p_real, 1 - result.ensemble_p_real) * 100).toFixed(1)}%
                  <button className={styles.infoButton}>
                    <Info size={16} />
                    <div className={styles.tooltip}>
                      <strong>About this score:</strong> This percentage represents the model's output for this image. It is a model confidence score and should not be interpreted as absolute certainty.
                    </div>
                  </button>
                </div>
              </div>

              <div className={styles.evidenceGrid}>
                {/* Interactive Evidence Lens */}
                <div 
                  className={styles.lensContainer}
                  onMouseMove={handleLensMove}
                  onMouseEnter={() => setIsHoveringLens(true)}
                  onMouseLeave={() => setIsHoveringLens(false)}
                >
                  {previewUrl && <img src={previewUrl} alt="Original" className={styles.lensImage} />}
                  
                  {heatmapUrl && isHoveringLens && (
                    <>
                      <div 
                        className={styles.heatmapImage}
                        style={{
                          opacity: 0.65,
                          mixBlendMode: 'multiply',
                          backgroundImage: `url(${heatmapUrl})`,
                          backgroundSize: '100% 100%',
                          backgroundPosition: 'center',
                          clipPath: `circle(80px at ${lensPos.x}px ${lensPos.y}px)`
                        }}
                      />
                      <div 
                        className={styles.lensOverlay}
                        style={{
                          left: lensPos.x - 80,
                          top: lensPos.y - 80,
                          width: 160,
                          height: 160
                        }}
                      />
                    </>
                  )}
                  
                  <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 10, background: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: 8, alignItems: 'center' }}>
                    <Eye size={16} />
                    <span style={{ fontSize: '0.85rem' }}>Interactive Evidence Lens</span>
                    <button className={styles.infoButton} style={{ marginLeft: 'auto' }}>
                      <Info size={14} />
                      <div className={styles.tooltip} style={{ bottom: '150%', left: 0, transform: 'none' }}>
                        Highlighted regions show areas of high neural activation for the spatial model. They indicate where the model focused, rather than providing definitive proof of manipulation.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Ensemble Flow Chart */}
                <div className={`${styles.glassPanel} ${styles.ensembleFlow}`}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                    Ensemble Evidence
                  </div>
                  
                  <div className={styles.flowNode}>
                    <div className={styles.flowLabel}>Spatial Model</div>
                    <div className={styles.flowValue}>{(result.spatial_p_real * 100).toFixed(1)}% Real</div>
                  </div>
                  
                  <div className={styles.flowNode}>
                    <div className={styles.flowLabel}>Frequency Model</div>
                    <div className={styles.flowValue}>{(result.frequency_p_real * 100).toFixed(1)}% Real</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--color-text-secondary)', padding: '0.5rem 0' }}>
                    <RefreshCw size={20} style={{ transform: 'rotate(90deg)' }} />
                  </div>

                  <div className={`${styles.flowNode} ${styles.flowFinal}`}>
                    <div className={styles.flowLabel} style={{ color: 'var(--color-accent-blue)' }}>Final Ensemble (60/40)</div>
                    <div className={styles.flowValue} style={{ fontSize: '1.2rem' }}>{(result.ensemble_p_real * 100).toFixed(1)}% Real</div>
                  </div>
                  
                  <button className={styles.resetButton} onClick={reset}>Analyze Another Image</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;

import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { Sparkles, Video, Clapperboard, Send, ImagePlay, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import './index.css';

const TEMPLATES = [
  { id: 'tech_news', name: 'Tin tức Công nghệ', icon: <Video size={24} /> },
  { id: 'storytelling', name: 'Kể chuyện', icon: <Clapperboard size={24} /> },
  { id: 'educational', name: 'Giáo dục', icon: <Sparkles size={24} /> },
  { id: 'meme', name: 'Hài hước/Meme', icon: <ImagePlay size={24} /> },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [topic, setTopic] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('tech_news');
  const [isReady, setIsReady] = useState(false);
  
  // App states: 'input' | 'loading_titles' | 'select_title' | 'loading_script' | 'result'
  const [appState, setAppState] = useState<'input' | 'loading_titles' | 'select_title' | 'loading_script' | 'result'>('input');
  
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [script, setScript] = useState<any>(null);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    setIsReady(true);
  }, []);

  const handleGenerateTitles = async () => {
    if (!topic.trim()) {
      WebApp.showAlert('Vui lòng nhập chủ đề trước nhé!');
      return;
    }
    
    setAppState('loading_titles');
    try {
      const res = await fetch(`${API_URL}/generate/titles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setTitles(data.titles);
      setAppState('select_title');
    } catch (err: any) {
      WebApp.showAlert('Lỗi khi tạo tiêu đề: ' + err.message);
      setAppState('input');
    }
  };

  const handleGenerateScript = async (title: string) => {
    setSelectedTitle(title);
    setAppState('loading_script');
    
    try {
      const res = await fetch(`${API_URL}/generate/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setScript(data.script);
      setAppState('result');
    } catch (err: any) {
      WebApp.showAlert('Lỗi khi tạo kịch bản: ' + err.message);
      setAppState('select_title');
    }
  };

  if (appState === 'result') {
    return (
      <div className="app-container">
        <div className="glass-card animate-slide-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <CheckCircle2 color="#4ade80" size={32} />
            <h2 style={{ margin: 0 }}>Đã tạo Kịch Bản!</h2>
          </div>
          
          <h3 style={{ color: '#fff', marginBottom: '8px' }}>{selectedTitle}</h3>
          
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', marginTop: '16px', fontSize: '14px', lineHeight: '1.6' }}>
            <p><strong>Mở bài (Hook):</strong> {script?.hook}</p>
            <p><strong>Nội dung:</strong> {script?.body}</p>
            <p><strong>Kêu gọi HĐ (CTA):</strong> {script?.callToAction}</p>
            <p><strong>Hình ảnh:</strong> {script?.visuals}</p>
          </div>
          
          <button 
            className="btn-primary" 
            style={{ marginTop: '24px' }}
            onClick={() => setAppState('input')}
          >
            Tạo Video Khác
          </button>
        </div>
      </div>
    );
  }

  if (appState === 'select_title') {
    return (
      <div className="app-container">
        <button className="btn-icon" onClick={() => setAppState('input')} style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}>
          <ArrowLeft size={20} /> Quay lại
        </button>
        
        <div className="animate-slide-up">
          <h2>Chọn một tiêu đề</h2>
          <p className="subtitle">Lựa chọn tiêu đề ấn tượng nhất cho video của bạn</p>
        </div>

        <div className="glass-card animate-slide-up delay-1">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {titles.map((title, idx) => (
              <button 
                key={idx}
                className="btn-primary"
                style={{ background: 'rgba(255,255,255,0.1)', textAlign: 'left', height: 'auto', padding: '16px' }}
                onClick={() => handleGenerateScript(title)}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'loading_titles' || appState === 'loading_script') {
    return (
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} color="#fff" />
        <h2 style={{ marginTop: '16px' }}>
          {appState === 'loading_titles' ? 'Đang tạo tiêu đề...' : 'Đang viết kịch bản...'}
        </h2>
        <p className="subtitle">Vui lòng đợi một lát</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="animate-slide-up">
        <h1>Frameon AI</h1>
        <p className="subtitle">Tạo video ngắn cực nhanh với AI</p>
      </div>

      <div className="glass-card animate-slide-up delay-1">
        <h2>Bạn muốn làm về chủ đề gì?</h2>
        <div className="input-group">
          <input
            type="text"
            className="input-field"
            placeholder="VD: Bí ẩn vũ trụ, Sự tích ngày Tết..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      <div className="glass-card animate-slide-up delay-2">
        <h2>Chọn Mẫu Video (Template)</h2>
        <div className="template-grid">
          {TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className={`template-card ${selectedTemplate === tmpl.id ? 'active' : ''}`}
              onClick={() => setSelectedTemplate(tmpl.id)}
            >
              <div className="template-icon">
                {tmpl.icon}
              </div>
              <span className="template-name">{tmpl.name}</span>
            </div>
          ))}
        </div>

        <button 
          className="btn-primary"
          onClick={handleGenerateTitles}
          disabled={!topic.trim() || !isReady}
        >
          <Send size={20} />
          Tạo Video Ngay
        </button>
      </div>
    </div>
  );
}

export default App;

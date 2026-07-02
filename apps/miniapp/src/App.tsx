import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { Sparkles, Video, Clapperboard, Send, ImagePlay } from 'lucide-react';
import './index.css';

const TEMPLATES = [
  { id: 'tech_news', name: 'Tech News', icon: <Video size={24} /> },
  { id: 'storytelling', name: 'Storytelling', icon: <Clapperboard size={24} /> },
  { id: 'educational', name: 'Educational', icon: <Sparkles size={24} /> },
  { id: 'meme', name: 'Meme/Humor', icon: <ImagePlay size={24} /> },
];

function App() {
  const [topic, setTopic] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('tech_news');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    setIsReady(true);
  }, []);

  const handleSubmit = () => {
    if (!topic.trim()) {
      WebApp.showAlert('Please enter a topic first!');
      return;
    }
    
    // Send data back to the Telegram bot
    WebApp.sendData(JSON.stringify({
      action: 'generate_video',
      topic,
      template: selectedTemplate
    }));
  };

  return (
    <div className="app-container">
      <div className="animate-slide-up">
        <h1>Frameon AI</h1>
        <p className="subtitle">Create short-form videos with AI instantly</p>
      </div>

      <div className="glass-card animate-slide-up delay-1">
        <h2>What's your topic?</h2>
        <div className="input-group">
          <input
            type="text"
            className="input-field"
            placeholder="e.g., The history of AI, Top 5 space facts..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      <div className="glass-card animate-slide-up delay-2">
        <h2>Choose Template</h2>
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
          onClick={handleSubmit}
          disabled={!topic.trim() || !isReady}
        >
          <Send size={20} />
          Generate Video
        </button>
      </div>
    </div>
  );
}

export default App;

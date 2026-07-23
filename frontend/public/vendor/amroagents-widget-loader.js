/**
 * AmroBot AI - Production Widget Loader v3.1.1
 * NO IFRAME - Direct Shadow DOM Rendering
 * Matches React ChatWidget components exactly
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.AmroBotWidgetLoader) {
    console.warn('[AmroBot] Widget already initialized');
    return;
  }
  window.AmroBotWidgetLoader = true;

  // ============================================
  // CONFIGURATION
  // ============================================
  
  function getApiUrl() {
    const hostname = window.location?.hostname || '';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }
    return 'https://amrobotai-backend-228113819475.europe-west2.run.app/api';
  }

  const API_URL = getApiUrl();
  const SOCKET_URL = API_URL.replace('/api', '');

  console.log('[AmroBot Widget v3.1.1] Initializing...');
  console.log('[AmroBot Widget] API:', API_URL);
  console.log('[AmroBot Widget] Socket URL:', SOCKET_URL);

  // Load Socket.IO client library (with loader pattern)
  let socketIOLoaded = false;
  function ensureSocketIOLoaded() {
    return new Promise((resolve) => {
      if (window.io) {
        socketIOLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        socketIOLoaded = true;
        console.log('[AmroBot] Socket.IO loaded successfully');
        resolve();
      };
      script.onerror = () => {
        console.warn('[AmroBot] Failed to load Socket.IO from CDN');
        resolve(); // Resolve anyway, will gracefully degrade
      };
      document.head.appendChild(script);
      console.log('[AmroBot] Loading Socket.IO client...');
    });
  }

  // Pre-load Socket.IO
  ensureSocketIOLoaded();

  // ============================================
  // SVG ICONS (Lucide-style)
  // ============================================
  
  const ICONS = {
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    headphones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
    fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line><line x1="10" x2="8" y1="9" y2="9"></line></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    moreHorizontal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`,
    messageSquare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    loader: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="6"></line><line x1="12" x2="12" y1="18" y2="22"></line><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"></line><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"></line><line x1="2" x2="6" y1="12" y2="12"></line><line x1="18" x2="22" y1="12" y2="12"></line><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"></line><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"></line></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    phoneOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="22" x2="2" y1="2" y2="22"></line></svg>`,
    micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 5"></path><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    ticket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v2"></path><path d="M13 17v2"></path><path d="M13 11v2"></path></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    starFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>`
  };

  const LAUNCHER_SPARKLE_SVG =
    '<svg class="brand-avatar-sparkle" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l1.76 6.24L20 10l-6.24 1.76L12 18l-1.76-6.24L4 10l6.24-1.76L12 2z"/></svg>';

  function renderBrandAvatar(size) {
    return `
      <div class="brand-avatar brand-avatar--${size}">
        <div class="brand-avatar-ring">
          <div class="brand-avatar-inner">
            ${LAUNCHER_SPARKLE_SVG}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================
  // UTILITIES
  // ============================================
  
  function generateId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function generateSessionId() {
    const stored = localStorage.getItem('amrobot_session_id');
    if (stored) return stored;
    const id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('amrobot_session_id', id);
    return id;
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false
    }).format(new Date(date));
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  // ============================================
  // WEB COMPONENT
  // ============================================
  
  class AmroBotChatWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      console.log('[AmroBot] Widget constructor called');

      // Widget state
      this.isOpen = false;
      this.settingsLoaded = false;
      this.settings = null;
      
      // Default settings matching WidgetSettings type
      this.botName = 'AmroBot AI';
      this.welcomeMessage = 'Hi! How can I help you today?';
      this.placeholderText = 'Type your message...';
      this.theme =
        this.getAttribute('theme') ||
        (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light');
      this.primaryColor = '#3B82F6';
      this.position = 'bottom-right';
      this.avatarUrl = '';
      this.showAvatar = true;
      this.showBranding = true;
      this.autoOpen = false;
      this.enableAgent = true;
      this.enableTicket = true;
      this.enableBooking = true;
      this.headerGradient = true;
      this.borderRadius = 'lg';
      this.shadowIntensity = 'medium';

      // Chat state
      this.messages = [];
      this.conversationId = null;
      this.sessionId = generateSessionId();
      this.isTyping = false;
      this.loading = false;
      this.unreadCount = 0;

      // Feature configs
      this.calendarEnabled = false;
      this.calendlyUrl = null;

      // Overlay states
      this.currentOverlay = null;
      this.liveChatSessionId = null;

      // Live chat state
      this.liveChatMessages = [];
      this.agentJoined = false;
      this.agentName = 'Support Agent';
      this.agentIsTyping = false;
      
      // Ticket state
      this.ticketSubmitted = false;
      this.ticketNumber = '';
      

      // Socket.IO connection
      this.socket = null;
      this.socketConnected = false;

    }

    static get observedAttributes() {
      return ['bot-id', 'chatbot-id', 'theme', 'position', 'primary-color', 'auto-open', 'delay', 'bot-name', 'welcome-message'];
    }

    connectedCallback() {
      console.log('[AmroBot] connectedCallback fired');
      
      // Support BOTH bot-id and chatbot-id attributes
      this.botId = this.getAttribute('bot-id') || 
                   this.getAttribute('chatbot-id') || 
                   this.getAttribute('data-bot-id') || 
                   this.getAttribute('data-chatbot-id');

      if (!this.botId) {
        console.error('[AmroBot] bot-id or chatbot-id attribute is required');
        return;
      }

      console.log('[AmroBot] Bot ID:', this.botId);

      // Override defaults from attributes
      if (this.getAttribute('theme')) this.theme = this.getAttribute('theme');
      if (this.getAttribute('position')) this.position = this.getAttribute('position');
      if (this.getAttribute('primary-color')) this.primaryColor = this.getAttribute('primary-color');
      if (this.getAttribute('bot-name')) this.botName = this.getAttribute('bot-name');
      if (this.getAttribute('welcome-message')) this.welcomeMessage = this.getAttribute('welcome-message');
      this.autoOpen = this.getAttribute('auto-open') === 'true';
      this.delay = parseInt(this.getAttribute('delay') || '0');

      // Load settings then render
      this.loadSettings().then(() => {
        console.log('[AmroBot] Settings loaded, rendering...');
        this.render();
        this.attachEventListeners();
        console.log('[AmroBot] Widget rendered successfully');
        
        if (this.autoOpen) {
          setTimeout(() => this.openWidget(), this.delay);
        }
      }).catch(err => {
        console.error('[AmroBot] Settings load failed:', err);
        // Render with defaults anyway
        this.render();
        this.attachEventListeners();
      });
    }

    async loadSettings() {
      try {
        console.log('[AmroBot] Loading settings for:', this.botId);

        const res = await fetch(`${API_URL}/chatbot-settings/${this.botId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          mode: 'cors',
          credentials: 'omit'
        });

        console.log('[AmroBot] Settings response status:', res.status);

        if (res.ok) {
          const data = await res.json();
          console.log('[AmroBot] Settings loaded:', data);

          this.settings = data;
          this.botName = data.bot_name_display || data.botName || this.botName;
          this.welcomeMessage = data.welcome_message || data.welcomeMessage || this.welcomeMessage;
          this.placeholderText = data.placeholder_text || data.placeholderText || this.placeholderText;
          this.primaryColor = data.theme_color || data.primaryColor || this.primaryColor;
          this.position = data.position || this.position;
          this.showBranding = data.show_branding !== false;
          this.avatarUrl = data.avatar_url || '';
          this.theme = this.getAttribute('theme') || this.theme;

          // Features
          this.enableAgent = data.enable_agent !== false;
          this.enableTicket = data.enable_ticket !== false;
          this.enableBooking = data.enable_booking !== false;

          // Calendar settings
          if (data.calendar_settings?.scheduling_url || data.calendar_settings?.calendlyUrl) {
            this.calendarEnabled = true;
            this.calendlyUrl = data.calendar_settings.scheduling_url || data.calendar_settings.calendlyUrl;
          }

          this.settingsLoaded = true;
        } else if (res.status === 404) {
          console.warn('[AmroBot] Chatbot not found or disabled');
          this.remove();
          return;
        } else {
          console.warn('[AmroBot] Failed to load settings, using defaults');
          this.settingsLoaded = true;
        }
      } catch (error) {
        console.error('[AmroBot] Settings load error:', error);
        this.settingsLoaded = true; // Use defaults
      }
    }

    // ============================================
    // STYLES
    // ============================================
    
    getStyles() {
      const isDark = this.theme === 'dark';
      const primaryColor = this.primaryColor;
      const primaryDark = adjustColor(primaryColor, -20);
      
      return `
        /* ===== HOST ===== */
        :host {
          display: block !important;
          position: fixed !important;
          bottom: 0 !important;
          right: 0 !important;
          left: auto !important;
          top: auto !important;
          z-index: 2147483647 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          pointer-events: none !important;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        /* Make interactive elements clickable */
        .toggle-button,
        .chat-window {
          pointer-events: auto !important;
        }

        /* ===== CSS VARIABLES ===== */
        :host {
          --primary: ${primaryColor};
          --primary-dark: ${primaryDark};
          --primary-foreground: #ffffff;
          --background: ${isDark ? '#0f172a' : '#ffffff'};
          --foreground: ${isDark ? '#f8fafc' : '#0f172a'};
          --card: ${isDark ? '#1e293b' : '#ffffff'};
          --card-foreground: ${isDark ? '#f8fafc' : '#0f172a'};
          --muted: ${isDark ? '#334155' : '#f1f5f9'};
          --muted-foreground: ${isDark ? '#94a3b8' : '#64748b'};
          --accent: ${isDark ? '#334155' : '#f1f5f9'};
          --accent-foreground: ${isDark ? '#f8fafc' : '#0f172a'};
          --border: ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 1)'};
          --secondary: ${isDark ? '#1e293b' : '#f1f5f9'};
          --secondary-foreground: ${isDark ? '#f8fafc' : '#0f172a'};
          --destructive: #ef4444;
          --ring: ${primaryColor};
        }

        /* ===== ANIMATIONS ===== */
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slide-up {
          from { 
            opacity: 0; 
            transform: translateY(16px) scale(0.95);
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1);
          }
        }

        @keyframes scale-in {
          from { 
            opacity: 0; 
            transform: scale(0.9);
          }
          to { 
            opacity: 1; 
            transform: scale(1);
          }
        }

        @keyframes typing-bounce {
          0%, 60%, 100% { 
            transform: translateY(0); 
          }
          30% { 
            transform: translateY(-4px); 
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .fade-in { animation: fade-in 0.2s ease-out; }
        .slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .scale-in { animation: scale-in 0.2s ease-out; }

        /* ===== SCROLLBAR ===== */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* ===== TOGGLE BUTTON (approved launcher — WhatsApp Image 2026-06-25) ===== */
        .toggle-button {
          position: fixed !important;
          ${this.position === 'bottom-right' ? 'right: 24px;' : 'left: 24px;'}
          bottom: 24px;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 8px 8px 18px;
          background: ${isDark ? 'rgba(15, 23, 42, 0.82)' : '#ffffff'};
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(226, 232, 240, 0.95)'};
          backdrop-filter: ${isDark ? 'blur(12px)' : 'none'};
          -webkit-backdrop-filter: ${isDark ? 'blur(12px)' : 'none'};
          border-radius: 9999px;
          box-shadow: ${
            isDark
              ? '0 10px 40px -10px rgba(0, 0, 0, 0.45), 0 0 28px -8px rgba(99, 102, 241, 0.35)'
              : '0 10px 40px -10px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)'
          };
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
        }

        .toggle-button:hover {
          box-shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border), 0 0 30px -10px var(--primary);
          transform: translateY(-2px);
        }

        .toggle-button.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none !important;
          transform: scale(0.8) translateY(10px);
        }

        .toggle-text {
          font-size: 14px;
          font-weight: 700;
          color: ${isDark ? '#ffffff' : '#0B1020'};
          white-space: nowrap;
          line-height: 1.55;
          padding-bottom: 0.14em;
        }

        @media (min-width: 640px) {
          .toggle-text {
            font-size: 16px;
          }
        }

        /* Chat Button Avatar */
        .toggle-avatar {
          position: relative;
          width: 56px;
          height: 56px;
        }

        .toggle-avatar-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #E879F9, #A855F7, #6366F1, #3B82F6, #22D3EE, #84CC16, #EAB308, #F97316, #E879F9);
          filter: blur(10px);
          opacity: ${isDark ? '0.8' : '0'};
        }

        .toggle-avatar-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #E879F9, #A855F7, #6366F1, #3B82F6, #22D3EE, #84CC16, #EAB308, #F97316, #E879F9);
          padding: 3px;
        }

        .toggle-avatar-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #0B1020;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toggle-avatar-sparkle {
          width: 26px;
          height: 26px;
          color: #ffffff;
        }

        /* ===== CHAT WINDOW ===== */
        .chat-window {
          position: fixed !important;
          ${this.position === 'bottom-right' ? 'right: 24px;' : 'left: 24px;'}
          bottom: 24px;
          width: 380px;
          height: 600px;
          max-width: calc(100vw - 48px);
          max-height: calc(100vh - 100px);
          background: var(--card);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 2147483647;
          opacity: 0;
          visibility: hidden;
          transform: translateY(16px) scale(0.95);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-window.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }

        /* ===== HEADER ===== */
        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, 
            ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'} 0%, 
            ${isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.08)'} 50%, 
            ${isDark ? 'rgba(236, 72, 153, 0.1)' : 'rgba(236, 72, 153, 0.05)'} 100%
          );
          border-bottom: 1px solid var(--border);
          border-radius: 16px 16px 0 0;
        }

        /* Header Avatar — same as Ask Amro launcher */
        .header-avatar {
          position: relative;
          width: 48px;
          height: 48px;
          flex-shrink: 0;
        }

        .brand-avatar {
          position: relative;
          flex-shrink: 0;
        }

        .brand-avatar--sm {
          width: 32px;
          height: 32px;
        }

        .brand-avatar--md {
          width: 48px;
          height: 48px;
        }

        .brand-avatar-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #E879F9, #A855F7, #6366F1, #3B82F6, #22D3EE, #84CC16, #EAB308, #F97316, #E879F9);
          padding: 3px;
        }

        .brand-avatar--sm .brand-avatar-ring {
          padding: 2px;
        }

        .brand-avatar-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #0B1020;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-avatar-sparkle {
          color: #ffffff;
        }

        .brand-avatar--sm .brand-avatar-sparkle {
          width: 14px;
          height: 14px;
        }

        .brand-avatar--md .brand-avatar-sparkle {
          width: 22px;
          height: 22px;
        }

        .header-avatar-online {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 12px;
          height: 12px;
          background: #10b981;
          border-radius: 50%;
          border: 2px solid var(--card);
        }

        .header-info {
          flex: 1;
          min-width: 0;
        }

        .header-info h3 {
          font-size: 15px;
          font-weight: 600;
          color: var(--foreground);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-info p {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 2px 0 0 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .header-btn {
          width: 36px;
          height: 36px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted-foreground);
          transition: all 0.2s ease;
        }

        .header-btn:hover {
          background: var(--accent);
          color: var(--foreground);
        }

        .header-btn svg {
          width: 20px;
          height: 20px;
        }

        /* ===== ACTION BUTTONS ===== */
        .action-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--card);
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .action-btn:hover {
          background: var(--accent);
        }

        .action-btn:active {
          transform: scale(0.95);
        }

        .action-btn svg {
          width: 20px;
          height: 20px;
          color: var(--muted-foreground);
          transition: color 0.2s ease;
        }

        .action-btn:hover svg {
          color: var(--foreground);
        }

        .action-btn span {
          font-size: 12px;
          font-weight: 500;
          color: var(--muted-foreground);
          transition: color 0.2s ease;
        }

        .action-btn:hover span {
          color: var(--foreground);
        }

        /* ===== MESSAGES CONTAINER ===== */
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: var(--background);
        }

        /* ===== MESSAGE BUBBLE ===== */
        .message {
          display: flex;
          gap: 8px;
          animation: fade-in 0.2s ease-out;
        }

        .message.user {
          flex-direction: row-reverse;
        }

        .message-avatar {
          flex-shrink: 0;
        }

        .message-avatar .brand-avatar--sm {
          width: 32px;
          height: 32px;
        }

        .message-avatar svg.brand-avatar-sparkle {
          display: block;
        }

        .message-avatar svg:not(.brand-avatar-sparkle) {
          width: 16px;
          height: 16px;
          color: var(--muted-foreground);
        }

        .message-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 80%;
        }

        .message-bubble {
          padding: 12px 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        /* User message */
        .message.user .message-bubble {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: var(--primary-foreground);
          border-radius: 16px 16px 4px 16px;
          box-shadow: 0 2px 8px -2px rgba(59, 130, 246, 0.3);
        }

        /* Bot message */
        .message.assistant .message-bubble {
          background: var(--secondary);
          color: var(--secondary-foreground);
          border-radius: 16px 16px 16px 4px;
        }

        .message-time {
          font-size: 11px;
          color: var(--muted-foreground);
          opacity: 0.7;
          padding: 0 4px;
        }

        .message.user .message-time {
          text-align: right;
        }

        /* ===== TYPING INDICATOR ===== */
        .typing-indicator {
          display: flex;
          gap: 8px;
          animation: fade-in 0.2s ease-out;
        }

        .typing-bubble {
          background: var(--secondary);
          border-radius: 16px 16px 16px 4px;
          padding: 12px 16px;
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--muted-foreground);
          animation: typing-bounce 1.4s infinite ease-in-out;
        }

        .typing-dot:nth-child(1) { animation-delay: 0s; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        /* ===== INPUT AREA ===== */
        .input-container {
          padding: 16px;
          background: var(--card);
          border-top: 1px solid var(--border);
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chat-input {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 12px;
          background: var(--secondary);
          color: var(--foreground);
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.2s ease;
        }

        .chat-input::placeholder {
          color: var(--muted-foreground);
        }

        .chat-input:focus {
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .send-button {
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: var(--primary-foreground);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          opacity: 0.9;
          box-shadow: 0 4px 15px -3px var(--primary);
        }

        .send-button:active:not(:disabled) {
          transform: scale(0.95);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-button svg {
          width: 20px;
          height: 20px;
        }

        /* ===== BRANDING ===== */
        .branding {
          padding: 8px 16px;
          text-align: center;
          border-top: 1px solid var(--border);
          background: var(--card);
        }

        .branding span {
          font-size: 11px;
          color: var(--muted-foreground);
        }

        .branding span strong {
          font-weight: 500;
        }

        /* ===== OVERLAY BASE ===== */
        .overlay {
          position: absolute;
          inset: 0;
          background: var(--card);
          z-index: 10;
          display: none;
          flex-direction: column;
          border-radius: inherit;
          overflow: hidden;
        }

        .overlay.visible {
          display: flex;
        }

        .overlay-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--border);
        }

        .overlay-header.gradient-orange {
          background: linear-gradient(135deg, #f97316, #ef4444);
          color: white;
          border-bottom: none;
        }

        .overlay-header.gradient-purple {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          color: white;
          border-bottom: none;
        }

        .overlay-header.gradient-blue {
          background: linear-gradient(135deg, var(--primary), #8b5cf6);
          color: white;
          border-bottom: none;
        }

        .overlay-back-btn {
          width: 36px;
          height: 36px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
          transition: all 0.2s ease;
        }

        .overlay-back-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .overlay-back-btn svg {
          width: 18px;
          height: 18px;
        }

        .overlay-title-group {
          flex: 1;
        }

        .overlay-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }

        .overlay-subtitle {
          font-size: 13px;
          opacity: 0.9;
          margin: 2px 0 0 0;
        }

        .overlay-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        /* ===== FORM STYLES ===== */
        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--foreground);
          margin-bottom: 6px;
        }

        .form-input,
        .form-textarea,
        .form-select {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--background);
          color: var(--foreground);
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.2s ease;
        }

        .form-input:focus,
        .form-textarea:focus,
        .form-select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-row {
          display: flex;
          gap: 12px;
        }

        .form-row > * {
          flex: 1;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: var(--primary-foreground);
        }

        .btn-outline {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--foreground);
        }

        .btn-outline:hover:not(:disabled) {
          background: var(--accent);
        }

        .btn-orange {
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
        }

        .btn-purple {
          background: linear-gradient(135deg, #a855f7, #9333ea);
          color: white;
        }

        .btn-full {
          width: 100%;
        }

        .btn svg {
          width: 18px;
          height: 18px;
        }

        /* ===== SUCCESS STATE ===== */
        .success-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          height: 100%;
        }

        .success-icon {
          width: 80px;
          height: 80px;
          background: #dcfce7;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .success-icon svg {
          width: 40px;
          height: 40px;
          color: #22c55e;
        }

        .success-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0 0 8px 0;
        }

        .success-message {
          font-size: 14px;
          color: var(--muted-foreground);
          margin: 0;
        }

        .success-ticket-number {
          font-family: monospace;
          font-size: 18px;
          font-weight: 700;
          color: var(--primary);
        }

        /* ===== LIVE CHAT STYLES ===== */
        .livechat-status-bar {
          padding: 8px 16px;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
        }

        .livechat-status-bar.waiting {
          background: #fef3c7;
          color: #92400e;
        }

        .livechat-status-bar.connected {
          background: #dcfce7;
          color: #166534;
        }

        .online-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 2s infinite;
        }

        .calendly-embed {
          flex: 1;
          width: 100%;
          border: none;
        }

        .calendly-footer {
          padding: 12px 16px;
          text-align: center;
          font-size: 12px;
          color: var(--muted-foreground);
          background: var(--card);
          border-top: 1px solid var(--border);
        }

        /* ===== LOADING ===== */
        .loading-spinner {
          animation: spin 1s linear infinite;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
          .toggle-button {
            right: 16px !important;
            bottom: 16px !important;
          }

          .chat-window {
            right: 16px !important;
            left: 16px !important;
            bottom: 80px !important;
            width: auto !important;
            height: 70vh !important;
            max-height: 70vh !important;
          }

          .toggle-avatar {
            width: 48px;
            height: 48px;
          }
        }
      `;
    }

    // ============================================
    // RENDER METHODS
    // ============================================
    
    render() {
      console.log('[AmroBot] Rendering widget...');
      
      const enabledActions = [];
      if (this.enableAgent) enabledActions.push({ id: 'agent', icon: ICONS.headphones, label: 'Agent' });
      if (this.enableTicket) enabledActions.push({ id: 'ticket', icon: ICONS.fileText, label: 'Ticket' });
      if (this.enableBooking) enabledActions.push({ id: 'book', icon: ICONS.calendar, label: 'Book' });

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>

        <!-- Toggle Button -->
        <button class="toggle-button" id="toggle-button" aria-label="Ask Amro">
          <span class="toggle-text">Ask Amro</span>
          <div class="toggle-avatar">
            <div class="toggle-avatar-glow"></div>
            <div class="toggle-avatar-ring">
              <div class="toggle-avatar-inner">
                <svg class="toggle-avatar-sparkle" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l1.76 6.24L20 10l-6.24 1.76L12 18l-1.76-6.24L4 10l6.24-1.76L12 2z"/></svg>
              </div>
            </div>
          </div>
        </button>

        <!-- Chat Window -->
        <div class="chat-window" id="chat-window">
          <!-- Header -->
          <div class="chat-header">
            <div class="header-avatar">
              ${renderBrandAvatar('md')}
              <div class="header-avatar-online"></div>
            </div>
            <div class="header-info">
              <h3>${escapeHtml(this.botName)}</h3>
              <p>Online • Ready to help</p>
            </div>
            <div class="header-actions">
              <button class="header-btn" id="menu-btn" aria-label="Menu">
                ${ICONS.moreHorizontal}
              </button>
              <button class="header-btn" id="close-btn" aria-label="Close">
                ${ICONS.x}
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          ${enabledActions.length > 0 ? `
            <div class="action-buttons">
              ${enabledActions.map(a => `
                <button class="action-btn" id="${a.id}-btn">
                  ${a.icon}
                  <span>${a.label}</span>
                </button>
              `).join('')}
            </div>
          ` : ''}

          <!-- Messages -->
          <div class="messages-container scrollbar-hide" id="messages-container"></div>

          <!-- Typing Indicator -->
          <div id="typing-container" style="display: none; padding: 0 16px 16px;">
            <div class="typing-indicator">
              <div class="message-avatar">
                ${renderBrandAvatar('sm')}
              </div>
              <div class="typing-bubble">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="input-container">
            <div class="input-wrapper">
              <input
                type="text"
                class="chat-input"
                id="chat-input"
                placeholder="${escapeHtml(this.placeholderText)}"
                autocomplete="off"
              />
              <button class="send-button" id="send-button" aria-label="Send">
                ${ICONS.send}
              </button>
            </div>
          </div>

          <!-- Branding -->
          ${this.showBranding ? `
            <div class="branding">
              <span>powered by <strong>AmroBot</strong></span>
            </div>
          ` : ''}

          <!-- Overlays -->
          ${this.renderTicketOverlay()}
          ${this.renderLiveChatOverlay()}
          ${this.renderCalendlyOverlay()}
        </div>
      `;

      console.log('[AmroBot] Widget HTML rendered');
    }

    renderTicketOverlay() {
      return `
        <div class="overlay" id="ticket-overlay">
          <div class="overlay-header gradient-orange">
            <button class="overlay-back-btn" id="ticket-back-btn">
              ${ICONS.arrowLeft}
            </button>
            <div class="overlay-title-group">
              <h2 class="overlay-title">🎫 Create Support Ticket</h2>
              <p class="overlay-subtitle">We'll help resolve your issue</p>
            </div>
          </div>
          <div class="overlay-content" id="ticket-content">
            <form id="ticket-form">
              <div class="form-group">
                <label class="form-label">Name *</label>
                <input type="text" class="form-input" id="ticket-name" placeholder="Your name" required />
              </div>
              <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="ticket-email" placeholder="your@email.com" required />
              </div>
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="tel" class="form-input" id="ticket-phone" placeholder="+1 (555) 000-0000" />
              </div>
              <div class="form-group">
                <label class="form-label">Category</label>
                <select class="form-select" id="ticket-category">
                  <option value="general">General Support</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical Issue</option>
                  <option value="feature">Feature Request</option>
                  <option value="bug">Bug Report</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Subject *</label>
                <input type="text" class="form-input" id="ticket-subject" placeholder="Brief description" required />
              </div>
              <div class="form-group">
                <label class="form-label">Description *</label>
                <textarea class="form-textarea" id="ticket-description" placeholder="Provide details..." required></textarea>
              </div>
              <div class="form-row">
                <button type="button" class="btn btn-outline btn-full" id="ticket-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-orange btn-full" id="ticket-submit-btn">
                  ${ICONS.ticket}
                  <span>Create Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    renderLiveChatOverlay() {
      return `
        <div class="overlay" id="livechat-overlay">
          <div class="overlay-header gradient-blue">
            <button class="overlay-back-btn" id="livechat-back-btn">
              ${ICONS.arrowLeft}
            </button>
            <div class="overlay-title-group">
              <h2 class="overlay-title">💬 Live Support</h2>
              <p class="overlay-subtitle">Chat with a human agent</p>
            </div>
          </div>
          <div class="livechat-status-bar waiting" id="livechat-status">
            Connecting you to an agent...
          </div>
          <div class="messages-container scrollbar-hide" id="livechat-messages"></div>
          <div class="input-container">
            <div class="input-wrapper">
              <input
                type="text"
                class="chat-input"
                id="livechat-input"
                placeholder="Type your message..."
                autocomplete="off"
              />
              <button class="send-button" id="livechat-send-btn">
                ${ICONS.send}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    renderCalendlyOverlay() {
      return `
        <div class="overlay" id="calendly-overlay">
          <div class="overlay-header gradient-purple">
            <button class="overlay-back-btn" id="calendly-back-btn">
              ${ICONS.arrowLeft}
            </button>
            <div class="overlay-title-group">
              <h2 class="overlay-title">📅 Book Appointment</h2>
              <p class="overlay-subtitle">Choose a time that works</p>
            </div>
          </div>
          <iframe class="calendly-embed" id="calendly-frame" src="about:blank"></iframe>
          <div class="calendly-footer">
            Powered by Calendly
          </div>
        </div>
      `;
    }


    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    attachEventListeners() {
      console.log('[AmroBot] Attaching event listeners...');
      
      const $ = (id) => this.shadowRoot.getElementById(id);

      // Toggle button
      $('toggle-button')?.addEventListener('click', () => {
        console.log('[AmroBot] Toggle button clicked');
        this.openWidget();
      });
      
      $('close-btn')?.addEventListener('click', () => {
        console.log('[AmroBot] Close button clicked');
        this.closeWidget();
      });

      // Send message
      $('send-button')?.addEventListener('click', () => this.handleSendMessage());
      $('chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });

      // Action buttons
      $('agent-btn')?.addEventListener('click', () => this.handleAgentClick());
      $('ticket-btn')?.addEventListener('click', () => this.showOverlay('ticket'));
      $('book-btn')?.addEventListener('click', () => this.handleBookClick());

      // Calendly overlay
      $('calendly-back-btn')?.addEventListener('click', () => this.hideOverlay('calendly'));


      console.log('[AmroBot] Event listeners attached');
    }

    // ============================================
    // WIDGET OPEN/CLOSE
    // ============================================
    
    openWidget() {
      console.log('[AmroBot] Opening widget');
      this.isOpen = true;
      
      const chatWindow = this.shadowRoot.getElementById('chat-window');
      const toggleBtn = this.shadowRoot.getElementById('toggle-button');
      
      if (chatWindow) {
        chatWindow.classList.add('open');
        console.log('[AmroBot] Chat window opened');
      }
      
      if (toggleBtn) {
        toggleBtn.classList.add('hidden');
      }

      // Add welcome message if first open
      if (this.messages.length === 0 && this.welcomeMessage) {
        this.addMessage({
          id: 'welcome',
          role: 'assistant',
          content: this.welcomeMessage,
          timestamp: new Date()
        });
      }

      // Focus input
      setTimeout(() => {
        this.shadowRoot.getElementById('chat-input')?.focus();
      }, 300);
    }

    closeWidget() {
      console.log('[AmroBot] Closing widget');
      this.isOpen = false;
      
      const chatWindow = this.shadowRoot.getElementById('chat-window');
      const toggleBtn = this.shadowRoot.getElementById('toggle-button');
      
      if (chatWindow) {
        chatWindow.classList.remove('open');
      }
      
      if (toggleBtn) {
        toggleBtn.classList.remove('hidden');
      }

      this.hideAllOverlays();
    }

    // ============================================
    // OVERLAY MANAGEMENT
    // ============================================
    
    showOverlay(type) {
      this.hideAllOverlays();
      const overlay = this.shadowRoot.getElementById(`${type}-overlay`);
      if (overlay) {
        overlay.classList.add('visible');
        this.currentOverlay = type;
      }
    }

    hideOverlay(type) {
      const overlay = this.shadowRoot.getElementById(`${type}-overlay`);
      if (overlay) {
        overlay.classList.remove('visible');
      }
      this.currentOverlay = null;
    }

    hideAllOverlays() {
      ['calendly', 'ticket', 'livechat'].forEach((type) => {
        this.hideOverlay(type);
      });
    }

    // ============================================
    // CHAT FUNCTIONALITY
    // ============================================
    
    addMessage(message) {
      this.messages.push(message);
      this.renderMessage(message);
      this.scrollToBottom();
    }

    renderMessage(message) {
      const container = this.shadowRoot.getElementById('messages-container');
      if (!container) return;

      const isUser = message.role === 'user';
      
      const messageEl = document.createElement('div');
      messageEl.className = `message ${message.role} fade-in`;
      messageEl.id = message.id;

      messageEl.innerHTML = `
        ${!isUser && this.showAvatar ? `
          <div class="message-avatar">
            ${renderBrandAvatar('sm')}
          </div>
        ` : ''}
        <div class="message-content">
          <div class="message-bubble">${escapeHtml(message.content)}</div>
          <span class="message-time">${formatTime(message.timestamp)}</span>
        </div>
      `;

      container.appendChild(messageEl);
    }

    updateLastAssistantMessage(content) {
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id !== 'welcome') {
        lastMsg.content = content;
        const bubble = this.shadowRoot.getElementById(lastMsg.id)?.querySelector('.message-bubble');
        if (bubble) bubble.textContent = content;
      } else {
        const newMsg = {
          id: generateId(),
          role: 'assistant',
          content: content,
          timestamp: new Date()
        };
        this.addMessage(newMsg);
      }
      this.scrollToBottom();
    }

    showTyping() {
      this.isTyping = true;
      const container = this.shadowRoot.getElementById('typing-container');
      if (container) container.style.display = 'block';
      this.scrollToBottom();
    }

    hideTyping() {
      this.isTyping = false;
      const container = this.shadowRoot.getElementById('typing-container');
      if (container) container.style.display = 'none';
    }

    scrollToBottom() {
      const container = this.shadowRoot.getElementById('messages-container');
      if (container) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 50);
      }
    }

    async handleSendMessage() {
      const input = this.shadowRoot.getElementById('chat-input');
      const content = input?.value?.trim();

      if (!content || this.loading) return;

      input.value = '';
      this.loading = true;

      // Add user message
      const userMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: new Date()
      };
      this.addMessage(userMessage);

      // Show typing
      this.showTyping();

      try {
          // ===== Legacy HTTP Streaming Path =====
          console.log('[AmroBot] 📡 Using legacy HTTP streaming backend');

          // Build messages array
          const messagesArray = this.messages
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content }));

          // Call chat API
          const response = await fetch(`${API_URL}/chat/${this.botId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messagesArray,
              conversationId: this.conversationId || undefined,
              sessionId: this.sessionId
            })
          });

          if (!response.ok) {
            throw new Error(`Chat request failed: ${response.status}`);
          }

          // Handle streaming response
          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';
            let buffer = '';
            let firstChunk = true;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              let newlineIndex;
              while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                let line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);

                if (line.endsWith('\r')) line = line.slice(0, -1);
                if (line.startsWith(':') || line.trim() === '') continue;
                if (!line.startsWith('data: ')) continue;

                const jsonStr = line.slice(6).trim();
                if (jsonStr === '[DONE]') break;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const chunk = parsed.choices?.[0]?.delta?.content;
                  if (chunk) {
                    if (firstChunk) {
                      this.hideTyping();
                      firstChunk = false;
                    }
                    assistantContent += chunk;
                    this.updateLastAssistantMessage(assistantContent);
                  }

                  if (parsed.conversationId && !this.conversationId) {
                    this.conversationId = parsed.conversationId;
                  }
                } catch (e) {
                  buffer = line + '\n' + buffer;
                  break;
                }
              }
            }
          } else {
            // Non-streaming response
            const data = await response.json();
            this.hideTyping();

            if (data.conversationId) {
              this.conversationId = data.conversationId;
            }

            const botMessage = {
              id: data.messageId || generateId(),
              role: 'assistant',
              content: data.message || data.response || 'No response received',
              timestamp: new Date()
            };
            this.addMessage(botMessage);
          }

      } catch (error) {
        console.error('[AmroBot] Chat error:', error);
        this.hideTyping();
        this.addMessage({
          id: generateId(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        });
      } finally {
        this.loading = false;
        this.hideTyping();
      }
    }

    // ============================================
    // AGENT HANDOFF
    // ============================================
    
    async initSocketIO() {
      if (this.socket) {
        console.log('[AmroBot] Socket.IO already initialized');
        return;
      }

      // Wait for Socket.IO to be loaded if not already
      if (!socketIOLoaded) {
        console.log('[AmroBot] Waiting for Socket.IO to load...');
        await ensureSocketIOLoaded();
      }

      if (!window.io) {
        console.error('[AmroBot] Socket.IO failed to load, cannot initialize');
        return;
      }

      console.log('[AmroBot] Initializing Socket.IO connection...');

      this.socket = window.io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket.id);
        this.socketConnected = true;
        
        // Rejoin live chat session if exists
        if (this.liveChatSessionId) {
          this.socket.emit('join_session', this.liveChatSessionId);
          console.log('📥 Rejoined live chat session:', this.liveChatSessionId);
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket.IO disconnected:', reason);
        this.socketConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        this.socketConnected = false;
      });

      // Listen for new messages from agents
      this.socket.on('new_message', (message) => {
        console.log('💬 New message received:', message);
        
        // Only show messages from agents (not from customer)
        if (message.sender_type === 'human' || message.sender_type === 'system') {
          this.displayLiveChatMessage(message);
        }
      });

      // Listen for agent joined
      this.socket.on('team_member_joined', (data) => {
        console.log('👥 Team member joined:', data);
        this.agentJoined = true;
        this.agentName = data.teamMember?.name || 'Support Agent';
        
        const statusBar = this.shadowRoot.getElementById('livechat-status');
        if (statusBar) {
          statusBar.textContent = `✅ ${this.agentName} joined the chat`;
        }
      });

      // Listen for typing indicators
      this.socket.on('typing', (data) => {
        if (data.sessionId === this.liveChatSessionId && data.user !== 'Customer') {
          this.agentIsTyping = data.isTyping;
          this.updateLiveChatTypingIndicator();
        }
      });

      // Listen for session updates
      this.socket.on('session_update', (data) => {
        if (data.sessionId === this.liveChatSessionId) {
          console.log('🔄 Session updated:', data);
          if (data.status === 'ended') {
            const statusBar = this.shadowRoot.getElementById('livechat-status');
            if (statusBar) {
              statusBar.textContent = '✅ Chat session ended';
            }
          }
        }
      });
    }

    displayLiveChatMessage(message) {
      const container = this.shadowRoot.getElementById('livechat-messages');
      if (!container) return;

      const msgEl = document.createElement('div');
      msgEl.className = `message ${message.sender_type === 'customer' ? 'user' : 'assistant'} fade-in`;
      
      const senderName = message.sender_type === 'system' ? 'System' : 
                        message.sender_type === 'human' ? (message.sender_name || this.agentName) : 
                        'You';
      
      msgEl.innerHTML = `
        <div class="message-content">
          ${message.sender_type !== 'customer' ? `<div class="message-sender">${escapeHtml(senderName)}</div>` : ''}
          <div class="message-bubble">${escapeHtml(message.content)}</div>
          <span class="message-time">${formatTime(message.created_at || new Date())}</span>
        </div>
      `;
      container.appendChild(msgEl);
      container.scrollTop = container.scrollHeight;
    }

    updateLiveChatTypingIndicator() {
      const container = this.shadowRoot.getElementById('livechat-messages');
      if (!container) return;

      // Remove existing typing indicator
      const existingIndicator = container.querySelector('.typing-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }

      // Add new typing indicator if agent is typing
      if (this.agentIsTyping) {
        const typingEl = document.createElement('div');
        typingEl.className = 'message assistant typing-indicator fade-in';
        typingEl.innerHTML = `
          <div class="message-content">
            <div class="message-sender">${escapeHtml(this.agentName)}</div>
            <div class="message-bubble">
              <div class="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        `;
        container.appendChild(typingEl);
        container.scrollTop = container.scrollHeight;
      }
    }

    async handleAgentClick() {
      console.log('[AmroBot] Agent button clicked');

      // Initialize Socket.IO if not already done
      if (!this.socket) {
        await this.initSocketIO();
      }
      
      try {
        const aiSummary = this.messages
          .filter(m => m.id !== 'welcome')
          .map(m => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.content}`)
          .join('\n');

        const response = await fetch(`${API_URL}/live-chat/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'trigger-handoff',
            chatbotId: this.botId,
            conversationId: this.conversationId,
            customerName: 'Guest User',
            customerEmail: 'guest@example.com',
            escalationReason: 'Customer requested live agent',
            aiSummary,
            messageHistory: this.messages.filter(m => m.id !== 'welcome'),
            isVIP: false
          })
        });

        if (!response.ok) throw new Error('Failed to initiate handoff');

        const data = await response.json();
        this.liveChatSessionId = data.sessionId;
        
        // Join the Socket.IO room for this session
        if (this.socket && this.socketConnected) {
          this.socket.emit('join_session', this.liveChatSessionId);
          console.log('📥 Joined live chat session:', this.liveChatSessionId);
        } else {
          console.warn('⚠️ Socket.IO not connected, will join on connect');
        }
        
        this.showOverlay('livechat');
        
        const statusBar = this.shadowRoot.getElementById('livechat-status');
        if (statusBar) {
          statusBar.textContent = '👋 Welcome! An agent will be with you shortly...';
        }

      } catch (error) {
        console.error('[AmroBot] Agent handoff error:', error);
        this.addMessage({
          id: generateId(),
          role: 'assistant',
          content: 'Could not connect to a live agent. Please try again later.',
          timestamp: new Date()
        });
      }
    }

    handleLiveChatSend() {
      const input = this.shadowRoot.getElementById('livechat-input');
      const content = input?.value?.trim();
      
      if (!content) return;
      
      input.value = '';

      // Stop typing indicator
      if (this.socket && this.socketConnected && this.liveChatSessionId) {
        this.socket.emit('typing', {
          sessionId: this.liveChatSessionId,
          isTyping: false,
          user: 'Customer'
        });
      }

      const container = this.shadowRoot.getElementById('livechat-messages');
      if (container) {
        const msgEl = document.createElement('div');
        msgEl.className = 'message user fade-in';
        msgEl.innerHTML = `
          <div class="message-content">
            <div class="message-bubble">${escapeHtml(content)}</div>
            <span class="message-time">${formatTime(new Date())}</span>
          </div>
        `;
        container.appendChild(msgEl);
        container.scrollTop = container.scrollHeight;
      }

      if (this.liveChatSessionId) {
        fetch(`${API_URL}/live-chat/sessions/${this.liveChatSessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            sender_type: 'customer',
            sender_name: 'Customer'
          })
        }).catch(err => console.error('[AmroBot] Live chat send error:', err));
      }
    }

    // ============================================
    // TICKET SUBMISSION
    // ============================================
    
    async handleTicketSubmit(e) {
      e.preventDefault();

      const getVal = (id) => this.shadowRoot.getElementById(id)?.value || '';
      
      const name = getVal('ticket-name');
      const email = getVal('ticket-email');
      const phone = getVal('ticket-phone');
      const category = getVal('ticket-category');
      const subject = getVal('ticket-subject');
      const description = getVal('ticket-description');

      if (!name || !email || !subject || !description) return;

      const submitBtn = this.shadowRoot.getElementById('ticket-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="loading-spinner">${ICONS.loader}</span><span>Submitting...</span>`;
      }

      try {
        const aiSummary = this.messages.length > 0
          ? this.messages.slice(-10).filter(m => m.id !== 'welcome').map(m => 
              `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.content}`
            ).join('\n')
          : 'No chat history';

        const response = await fetch(`${API_URL}/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatbotId: this.botId,
            conversationId: this.conversationId,
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            subject,
            description,
            category,
            aiSummary,
            priority: 'medium'
          })
        });

        if (!response.ok) throw new Error('Failed to create ticket');

        const data = await response.json();
        this.ticketNumber = data.ticketNumber;
        this.ticketSubmitted = true;

        const content = this.shadowRoot.getElementById('ticket-content');
        if (content) {
          content.innerHTML = `
            <div class="success-container">
              <div class="success-icon">
                ${ICONS.checkCircle}
              </div>
              <h3 class="success-title">Ticket Submitted!</h3>
              <p class="success-message">
                Your ticket number is <span class="success-ticket-number">${this.ticketNumber}</span>
              </p>
              <p class="success-message" style="margin-top: 8px;">
                We'll get back to you at ${email}
              </p>
            </div>
          `;
        }

        setTimeout(() => {
          this.hideOverlay('ticket');
          this.ticketSubmitted = false;
          this.render();
          this.attachEventListeners();
        }, 3000);

      } catch (error) {
        console.error('[AmroBot] Ticket error:', error);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `${ICONS.ticket}<span>Create Ticket</span>`;
        }
        alert('Failed to create ticket. Please try again.');
      }
    }

    // ============================================
    // BOOKING / CALENDLY
    // ============================================
    
    async handleBookClick() {
      if (!this.calendlyUrl) {
        try {
          const response = await fetch(`${API_URL}/calendly/config/${this.botId}`);
          if (response.ok) {
            const data = await response.json();
            this.calendlyUrl = data.schedulingUrl || data.calendlyUrl;
          }
        } catch (e) {
          console.warn('[AmroBot] Could not load calendar config');
        }
      }

      if (!this.calendlyUrl) {
        this.addMessage({
          id: generateId(),
          role: 'assistant',
          content: 'Calendar booking is not configured.',
          timestamp: new Date()
        });
        return;
      }

      this.showOverlay('calendly');

      const iframe = this.shadowRoot.getElementById('calendly-frame');
      if (iframe) {
        iframe.src = this.calendlyUrl;
      }
    }

  }

  // ============================================
  // REGISTER COMPONENT
  // ============================================
  
  if (!customElements.get('amrobot-chat')) {
    customElements.define('amrobot-chat', AmroBotChatWidget);
    console.log('[AmroBot] Custom element registered');
  }

  // ============================================
  // GLOBAL API
  // ============================================
  
  window.AmroBotWidget = {
    version: '3.1.1',
    instances: new Map(),

    init(config) {
      console.log('[AmroBot] init() called with:', config);
      
      if (!config?.botId) {
        console.error('[AmroBot] botId is required');
        return null;
      }

      if (this.instances.has(config.botId)) {
        console.warn('[AmroBot] Widget already exists for:', config.botId);
        return this.instances.get(config.botId);
      }

      const widget = document.createElement('amrobot-chat');
      
      // Support both bot-id and chatbot-id
      widget.setAttribute('bot-id', config.botId);
      widget.setAttribute('chatbot-id', config.botId);
      
      if (config.theme) widget.setAttribute('theme', config.theme);
      if (config.position) widget.setAttribute('position', config.position);
      if (config.primaryColor) widget.setAttribute('primary-color', config.primaryColor);
      if (config.botName) widget.setAttribute('bot-name', config.botName);
      if (config.welcomeMessage) widget.setAttribute('welcome-message', config.welcomeMessage);
      if (config.autoOpen) widget.setAttribute('auto-open', 'true');
      if (config.delay) widget.setAttribute('delay', String(config.delay));

      document.body.appendChild(widget);
      this.instances.set(config.botId, widget);

      console.log('[AmroBot] Widget created for:', config.botId);
      return widget;
    },

    open() {
      const widget = document.querySelector('amrobot-chat');
      widget?.openWidget?.();
    },

    close() {
      const widget = document.querySelector('amrobot-chat');
      widget?.closeWidget?.();
    },

    toggle() {
      const widget = document.querySelector('amrobot-chat');
      if (widget?.isOpen) widget.closeWidget();
      else widget?.openWidget?.();
    }
  };

  // ============================================
  // AUTO-INIT FROM SCRIPT TAG
  // ============================================
  
  function autoInit() {
    // Find ALL script tags that might be ours
    const scripts = document.querySelectorAll('script[data-bot-id], script[data-chatbot-id]');
    
    scripts.forEach(script => {
      // Support BOTH attribute names
      const botId = script.getAttribute('data-bot-id') || script.getAttribute('data-chatbot-id');
      
      if (botId && !window.AmroBotWidget.instances.has(botId)) {
        console.log('[AmroBot] Auto-initializing for bot:', botId);
        
        window.AmroBotWidget.init({
          botId,
          theme: script.getAttribute('data-theme'),
          position: script.getAttribute('data-position'),
          primaryColor: script.getAttribute('data-primary-color'),
          botName: script.getAttribute('data-bot-name'),
          welcomeMessage: script.getAttribute('data-welcome-message'),
          autoOpen: script.getAttribute('data-auto-open') === 'true',
          delay: parseInt(script.getAttribute('data-delay') || '0')
        });
      }
    });
  }

  // Run auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // DOM already loaded
    autoInit();
  }

  console.log('[AmroBot Widget v3.1.1] Ready');

})();
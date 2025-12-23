<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - Content Manager</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        .admin-container { max-width: 900px; margin: 0 auto; padding: 2rem; }
        .admin-card { background: var(--medium-dark-bg); padding: 2rem; border-radius: 16px; border: 1px solid var(--border-color); margin-bottom: 2rem; display:none; }
        .admin-card.active { display: block; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary); }
        .form-group input, .form-group textarea { width: 100%; padding: 0.8rem; background: var(--dark-bg); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; }
        .status-msg { margin-top: 1rem; font-weight: 500; }
        .status-success { color: var(--success-green); }
        .status-error { color: var(--error-red); }
        .preview-img { max-width: 100%; margin-top: 1rem; border-radius: 8px; border: 1px solid var(--border-color); display: none; }
        code { background: #333; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
        
        .nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .nav-tab { background: var(--light-dark-bg); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 8px; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; }
        .nav-tab:hover { background: #333; }
        .nav-tab.active { background: var(--primary-blue); color: white; border-color: var(--primary-blue); }
        .helper-text { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; line-height: 1.4; }
        .helper-text code { display: block; margin-top: 0.5rem; white-space: pre-wrap; word-break: break-all; }
    </style>
</head>
<body>

    <header id="header-bar" class="app-header app-container"></header>

    <main class="admin-container">
        <h1>Content Manager</h1>
        
        <!-- Login Protection -->
        <div id="login-warning" style="display:none; text-align:center; padding:2rem; background:var(--medium-dark-bg); border-radius:8px;">
            <h3>Restricted Access</h3>
            <p>Please log in with an authorized account.</p>
        </div>

        <div id="admin-content" style="display:none;">
            <div class="nav-tabs" id="admin-tabs">
                <button class="nav-tab active" data-target="ppdt">PPDT (Images)</button>
                <button class="nav-tab" data-target="tat">TAT (Images)</button>
                <button class="nav-tab" data-target="oir">OIR (Questions)</button>
                <button class="nav-tab" data-target="wat">WAT (Words)</button>
                <button class="nav-tab" data-target="srt">SRT (Situations)</button>
            </div>
            
            <!-- PPDT UPLOADER (Default) -->
            <div class="admin-card active" id="card-ppdt">
                <h2>PPDT Management</h2>
                <div class="form-group">
                    <label>Bulk Upload JSON</label>
                    <input type="file" id="ppdt-json" accept=".json">
                    <div class="helper-text">
                        Required JSON Format:
                        <code>[
  { "link": "https://drive.google.com/...", "description": "Group discussion" },
  ...
]</code>
                    </div>
                    <button class="start-btn mt-2" onclick="handleBulk('ppdt')">Upload PPDT</button>
                    <div id="status-ppdt" class="status-msg"></div>
                </div>
                <div class="form-group border-t pt-4">
                    <label>Single Image Link</label>
                    <input type="text" id="ppdt-single-link" placeholder="Drive Link">
                    <button class="start-btn mt-2" onclick="handleSingle('ppdt')">Add Single</button>
                </div>
                <div id="list-ppdt">Loading...</div>
            </div>

            <!-- TAT UPLOADER -->
            <div class="admin-card" id="card-tat">
                <h2>TAT Management</h2>
                <div class="form-group">
                    <label>Bulk Upload JSON</label>
                    <input type="file" id="tat-json" accept=".json">
                    <div class="helper-text">
                        Required JSON Format:
                        <code>[
  { "link": "https://drive.google.com/...", "description": "Person sitting alone" },
  ...
]</code>
                    </div>
                    <button class="start-btn mt-2" onclick="handleBulk('tat')">Upload TAT</button>
                    <div id="status-tat" class="status-msg"></div>
                </div>
                <div id="list-tat">Loading...</div>
            </div>

            <!-- OIR UPLOADER -->
            <div class="admin-card" id="card-oir">
                <h2>OIR Management</h2>
                <div class="form-group">
                    <label>Bulk Upload JSON</label>
                    <input type="file" id="oir-json" accept=".json">
                    <div class="helper-text">
                        Required JSON Format (Standard):
                        <code>[
  { 
    "question": "Question text?", 
    "options": ["A", "B", "C", "D"], 
    "answer": "A", 
    "type": "verbal" 
  },
  ...
]</code>
                        With Image (Optional):
                        <code>[
  { 
    "question": "Identify figure", 
    "image": "https://drive.google.com/...", 
    "options": ["1", "2", "3", "4"], 
    "answer": "1", 
    "type": "spatial" 
  }
]</code>
                    </div>
                    <button class="start-btn mt-2" onclick="handleBulk('oir')">Upload OIR</button>
                    <div id="status-oir" class="status-msg"></div>
                </div>
                <div id="list-oir">Loading...</div>
            </div>

            <!-- WAT UPLOADER -->
            <div class="admin-card" id="card-wat">
                <h2>WAT Management</h2>
                <div class="form-group">
                    <label>Bulk Upload JSON</label>
                    <input type="file" id="wat-json" accept=".json">
                    <div class="helper-text">
                        Required JSON Format:
                        <code>[
  { "word": "Courage" },
  { "word": "Fear" },
  ...
]</code>
                    </div>
                    <button class="start-btn mt-2" onclick="handleBulk('wat')">Upload WAT</button>
                    <div id="status-wat" class="status-msg"></div>
                </div>
                <div id="list-wat">Loading...</div>
            </div>

            <!-- SRT UPLOADER -->
            <div class="admin-card" id="card-srt">
                <h2>SRT Management</h2>
                <div class="form-group">
                    <label>Bulk Upload JSON</label>
                    <input type="file" id="srt-json" accept=".json">
                    <div class="helper-text">
                        Required JSON Format:
                        <code>[
  { "situation": "He was alone in the jungle..." },
  { "situation": "His captain was injured..." },
  ...
]</code>
                    </div>
                    <button class="start-btn mt-2" onclick="handleBulk('srt')">Upload SRT</button>
                    <div id="status-srt" class="status-msg"></div>
                </div>
                <div id="list-srt">Loading...</div>
            </div>

        </div>
    </main>

    <script type="module" src="js/main.js"></script>
    <script type="module" src="js/admin.js"></script>
</body>
</html>

// Main app logic for Note Pilot

// Utility to format timestamp nicely
function formatNow() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ---- DOM Ready ----
document.addEventListener('DOMContentLoaded', () => {
  const topicInput = document.getElementById('topic-input');
  const notesContainer = document.getElementById('notes-container');
  const savedGrid = document.getElementById('saved-notes');
  const loader = document.getElementById('loader');
  const searchInput = document.getElementById('search-input');
  const darkToggle = document.getElementById('dark-toggle');
  const clearAllBtn = document.getElementById('clear-all');

  // initialize dark mode from localStorage
  if (localStorage.getItem('np_dark') === '1') document.body.classList.add('dark');
  darkToggle.checked = document.body.classList.contains('dark');
  darkToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('np_dark', document.body.classList.contains('dark') ? '1' : '0');
  });

  // load existing notes
  loadNotesIntoUI();

  // Enter handler
  topicInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && topicInput.value.trim() !== '') {
      const topic = topicInput.value.trim();
      topicInput.value = '';
      loader.style.display = 'block';
      try {
        await handleTopicSearch(topic);
      } catch (err) {
        console.error(err);
        alert('Could not fetch suggestion. See console for details.');
      } finally {
        loader.style.display = 'none';
      }
    }
  });

  // Search filtering
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    filterSaved(q);
  });

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Clear all saved notes?')) return;
    localStorage.removeItem('savedNotes');
    loadNotesIntoUI();
  });

  // Handle creating suggestion and accept flow
  async function handleTopicSearch(topic) {
    const suggestionText = await getAISuggestion(topic);
    const now = formatNow();

    const wrapper = document.createElement('div');
    wrapper.className = 'note-wrapper';

    const note = document.createElement('div');
    note.className = 'note suggestion';
    note.innerHTML = `<div class="note-header"><div class="note-topic">${topic}</div><div class="note-time">${now}</div></div>
                      <div class="note-body">[${topic}] ${escapeHtml(suggestionText)}</div>`;

    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'accept-btn';
    acceptBtn.innerText = 'Accept';
    acceptBtn.onclick = () => {
      // make editable, save
      note.classList.remove('suggestion');
      const body = note.querySelector('.note-body');
      body.contentEditable = true;
      body.focus();

      const savedObj = { topic, text: unescapeHtml(body.innerText), timestamp: now };
      saveNote(savedObj);

      // autosave edits
      body.addEventListener('input', () => {
        const newText = body.innerText.replace(`[${topic}] `, '');
        updateNote(topic, newText);
        syncSavedGrid();
      });

      actions.innerHTML = '';
      addDeleteButton(actions, wrapper, topic);
      syncSavedGrid();
    };

    const discardBtn = document.createElement('button');
    discardBtn.className = 'discard-btn';
    discardBtn.innerText = 'Discard';
    discardBtn.onclick = () => wrapper.remove();

    actions.appendChild(acceptBtn);
    actions.appendChild(discardBtn);

    wrapper.appendChild(note);
    wrapper.appendChild(actions);
    notesContainer.prepend(wrapper);
  }

  // Add delete button
  function addDeleteButton(container, wrapper, topic) {
    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.innerText = 'Delete';
    del.onclick = () => {
      if (!confirm('Delete this note?')) return;
      deleteNote(topic);
      wrapper.remove();
      syncSavedGrid();
    };
    container.appendChild(del);
  }

  // ---- Storage helpers ----
  function getSavedNotes() {
    return JSON.parse(localStorage.getItem('savedNotes') || '[]');
  }
  function saveNote(noteObj) {
    const notes = getSavedNotes();
    // replace if same topic exists (update), else push
    const idx = notes.findIndex(n => n.topic === noteObj.topic);
    if (idx >= 0) notes[idx] = noteObj;
    else notes.push(noteObj);
    localStorage.setItem('savedNotes', JSON.stringify(notes));
    syncSavedGrid();
  }
  function updateNote(topic, newText) {
    const notes = getSavedNotes();
    const n = notes.find(x => x.topic === topic);
    if (n) { n.text = newText; n.timestamp = formatNow(); localStorage.setItem('savedNotes', JSON.stringify(notes)); }
  }
  function deleteNote(topic) {
    let notes = getSavedNotes();
    notes = notes.filter(n => n.topic !== topic);
    localStorage.setItem('savedNotes', JSON.stringify(notes));
  }

  // ---- UI render for saved grid ----
  function syncSavedGrid() {
    const saved = getSavedNotes();
    savedGrid.innerHTML = '';
    saved.forEach(n => {
      const card = document.createElement('div');
      card.className = 'panel-card note-card-mini';
      card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
                          <div><strong>${escapeHtml(n.topic)}</strong><div class="muted small">${escapeHtml(n.timestamp)}</div></div>
                          <div><button class="delete-btn small-btn">Delete</button></div>
                        </div>
                        <div class="muted note-preview">${escapeHtml(n.text)}</div>`;
      // delete handler
      card.querySelector('.delete-btn').addEventListener('click', () => {
        if (!confirm('Delete this note?')) return;
        deleteNote(n.topic);
        syncSavedGrid();
        loadNotesIntoUI();
      });
      savedGrid.appendChild(card);
    });
    filterSaved(searchInput.value.trim().toLowerCase());
  }

  // Render saved notes in main list
  function loadNotesIntoUI() {
    const notes = getSavedNotes();
    notesContainer.innerHTML = '';
    notes.forEach(n => displaySavedNote(n));
    syncSavedGrid();
  }

  function displaySavedNote(n) {
    const wrapper = document.createElement('div');
    wrapper.className = 'note-wrapper';
    const note = document.createElement('div');
    note.className = 'note saved';
    note.innerHTML = `<div class="note-header"><div class="note-topic">${escapeHtml(n.topic)}</div><div class="note-time">${escapeHtml(n.timestamp)}</div></div>
                      <div class="note-body" contenteditable="true">${escapeHtml(n.text)}</div>`;
    // autosave on edit
    const body = note.querySelector('.note-body');
    body.addEventListener('input', () => {
      const newText = body.innerText.replace(`[${n.topic}] `, '');
      updateNote(n.topic, newText);
      syncSavedGrid();
    });
    const actions = document.createElement('div');
    actions.className = 'note-actions';
    addDeleteButton(actions, wrapper, n.topic);
    wrapper.appendChild(note);
    wrapper.appendChild(actions);
    notesContainer.appendChild(wrapper);
  }

  // Search/filter in both main & side saved grid
  function filterSaved(q) {
    // filter side grid cards
    Array.from(savedGrid.children).forEach(card => {
      const text = card.innerText.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
    // main list
    Array.from(notesContainer.children).forEach(wrapper => {
      const text = wrapper.innerText.toLowerCase();
      wrapper.style.display = text.includes(q) ? '' : 'none';
    });
  }

  // ---- Utilities ----
  function escapeHtml(str){ return String(str).replace(/[&<>"]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s])); }
  function unescapeHtml(s){ return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"'); }

}); // DOMContentLoaded end

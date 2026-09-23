/**
 * Music Player Module for ulolTris
 * Provides a drag-and-drop music player with playlist, crossfading, and transport controls.
 */

/**
 * Creates a drag-and-drop music player.
 * @param {HTMLElement} containerEl - The container element to attach the player to.
 * @param {Object} settingsRef - Reference to settings object containing volume and crossfade duration.
 * @returns {Object} The music player interface.
 */
export function createMusicPlayer(containerEl, settingsRef) {
    // State
    const state = {
        playlist: [],
        currentIndex: -1,
        isPlaying: false,
        shuffle: false,
        repeat: 0, // 0: off, 1: all, 2: one
        minimized: true,
        activePlayer: 0, // 0 or 1 for crossfading
        audioContext: null
    };

    // DOM Elements
    const elements = {};

    // Players setup
    const players = [
        { audio: new Audio(), source: null, gain: null },
        { audio: new Audio(), source: null, gain: null }
    ];

    // Initialize Web Audio API if needed (user interaction required for AudioContext)
    function initAudioContext() {
        if (!state.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            state.audioContext = new AudioContext();
            
            players.forEach(p => {
                p.source = state.audioContext.createMediaElementSource(p.audio);
                p.gain = state.audioContext.createGain();
                p.source.connect(p.gain);
                p.gain.connect(state.audioContext.destination);
                p.audio.addEventListener('ended', onTrackEnded);
            });
        }
        if (state.audioContext.state === 'suspended') {
            state.audioContext.resume();
        }
    }

    // --- DOM Construction ---
    function buildUI() {
        const wrapper = document.createElement('div');
        wrapper.className = 'mp-container mp-minimized';
        elements.wrapper = wrapper;

        // Header with title and close button
        const header = document.createElement('div');
        header.className = 'mp-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '6px';

        const title = document.createElement('h3');
        title.style.margin = '0';
        title.style.fontSize = '14px';
        title.style.letterSpacing = '2px';
        title.style.color = '#c0c0c0';
        title.textContent = 'MUSIC PLAYER';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'settings-close';
        closeBtn.innerHTML = '&#x00D7;';
        closeBtn.addEventListener('click', toggle);

        header.appendChild(title);
        header.appendChild(closeBtn);
        wrapper.appendChild(header);

        const panel = document.createElement('div');
        panel.className = 'mp-panel';
        elements.panel = panel;
        wrapper.appendChild(panel);

        // Drop zone
        const dropZone = document.createElement('div');
        dropZone.className = 'mp-drop-zone';
        const dropText = document.createElement('span');
        dropText.textContent = 'Drop audio files here or ';
        dropZone.appendChild(dropText);
        
        const browseBtn = document.createElement('button');
        browseBtn.textContent = 'Browse';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'audio/*';
        fileInput.style.display = 'none';
        
        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
        
        dropZone.appendChild(browseBtn);
        dropZone.appendChild(fileInput);
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
            handleFiles(e.dataTransfer.files);
        });
        panel.appendChild(dropZone);

        // Now Playing
        const nowPlaying = document.createElement('div');
        nowPlaying.className = 'mp-now-playing';
        const marquee = document.createElement('div');
        marquee.className = 'mp-marquee';
        marquee.textContent = 'No track selected';
        elements.nowPlayingText = marquee;
        nowPlaying.appendChild(marquee);
        panel.appendChild(nowPlaying);

        // Progress
        const progressContainer = document.createElement('div');
        progressContainer.className = 'mp-progress';
        const progressFill = document.createElement('div');
        progressFill.className = 'mp-progress-fill';
        progressFill.style.width = '0%';
        elements.progressFill = progressFill;
        
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'mp-progress-time';
        timeDisplay.textContent = '00:00 / 00:00';
        elements.timeDisplay = timeDisplay;

        progressContainer.appendChild(progressFill);
        progressContainer.addEventListener('click', seek);
        
        panel.appendChild(progressContainer);
        panel.appendChild(timeDisplay);

        // Transport
        const transport = document.createElement('div');
        transport.className = 'mp-transport';
        
        const btnShuffle = document.createElement('button');
        btnShuffle.className = 'mp-btn';
        btnShuffle.textContent = '🔀';
        btnShuffle.addEventListener('click', toggleShuffle);
        elements.btnShuffle = btnShuffle;

        const btnPrev = document.createElement('button');
        btnPrev.className = 'mp-btn';
        btnPrev.textContent = '⏮';
        btnPrev.addEventListener('click', playPrev);

        const btnPlay = document.createElement('button');
        btnPlay.className = 'mp-btn';
        btnPlay.textContent = '▶';
        btnPlay.addEventListener('click', togglePlay);
        elements.btnPlay = btnPlay;

        const btnNext = document.createElement('button');
        btnNext.className = 'mp-btn';
        btnNext.textContent = '⏭';
        btnNext.addEventListener('click', playNext);

        const btnRepeat = document.createElement('button');
        btnRepeat.className = 'mp-btn';
        btnRepeat.textContent = '↻';
        btnRepeat.addEventListener('click', toggleRepeat);
        elements.btnRepeat = btnRepeat;

        transport.appendChild(btnShuffle);
        transport.appendChild(btnPrev);
        transport.appendChild(btnPlay);
        transport.appendChild(btnNext);
        transport.appendChild(btnRepeat);
        panel.appendChild(transport);

        // Volume
        const volume = document.createElement('div');
        volume.className = 'mp-volume';
        
        const volIcon = document.createElement('span');
        volIcon.className = 'mp-volume-icon';
        volIcon.textContent = settingsRef.musicMuted ? '🔇' : '🔊';
        volIcon.style.cursor = 'pointer';
        volIcon.addEventListener('click', () => {
            settingsRef.musicMuted = !settingsRef.musicMuted;
            updateVolume();
        });
        elements.volIcon = volIcon;

        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'mp-volume-slider';
        volSlider.min = 0;
        volSlider.max = 100;
        volSlider.value = settingsRef.musicVolume;
        volSlider.addEventListener('input', (e) => {
            settingsRef.musicVolume = Number(e.target.value);
            settingsRef.musicMuted = false;
            updateVolume();
        });
        elements.volSlider = volSlider;

        volume.appendChild(volIcon);
        volume.appendChild(volSlider);
        panel.appendChild(volume);

        // Playlist
        const playlist = document.createElement('div');
        playlist.className = 'mp-playlist';
        elements.playlist = playlist;
        panel.appendChild(playlist);

        containerEl.appendChild(wrapper);
        requestAnimationFrame(updateLoop);
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function handleFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('audio/')) {
                const url = URL.createObjectURL(file);
                
                // Get duration
                const tempAudio = new Audio(url);
                tempAudio.addEventListener('loadedmetadata', () => {
                    const track = {
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        file: file,
                        url: url,
                        duration: tempAudio.duration
                    };
                    state.playlist.push(track);
                    renderPlaylist();
                    
                    if (state.playlist.length === 1 && !state.isPlaying) {
                        playTrack(0);
                    }
                });
            }
        }
    }

    function renderPlaylist() {
        elements.playlist.innerHTML = '';
        state.playlist.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'mp-track';
            if (index === state.currentIndex) {
                item.classList.add('playing');
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'mp-track-name';
            nameSpan.textContent = `${index + 1}. ${track.name}`;
            nameSpan.style.cursor = 'pointer';
            nameSpan.addEventListener('click', () => playTrack(index));

            const durSpan = document.createElement('span');
            durSpan.className = 'mp-track-duration';
            durSpan.textContent = formatTime(track.duration);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'mp-track-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTrack(index);
            });

            item.appendChild(nameSpan);
            item.appendChild(durSpan);
            item.appendChild(removeBtn);
            elements.playlist.appendChild(item);
        });
    }

    function removeTrack(index) {
        URL.revokeObjectURL(state.playlist[index].url);
        state.playlist.splice(index, 1);
        
        if (index === state.currentIndex) {
            if (state.playlist.length === 0) {
                stopPlayback();
            } else {
                playTrack(index % state.playlist.length);
            }
        } else if (index < state.currentIndex) {
            state.currentIndex--;
        }
        
        renderPlaylist();
    }

    function stopPlayback() {
        const p = players[state.activePlayer];
        p.audio.pause();
        state.isPlaying = false;
        state.currentIndex = -1;
        elements.btnPlay.textContent = '▶';
        elements.nowPlayingText.textContent = 'No track selected';
    }

    function playTrack(index, useCrossfade = true) {
        if (state.playlist.length === 0 || index < 0 || index >= state.playlist.length) return;
        
        initAudioContext();
        
        const track = state.playlist[index];
        const nextPlayerIdx = (state.activePlayer + 1) % 2;
        const currentPlayer = players[state.activePlayer];
        const nextPlayer = players[nextPlayerIdx];

        nextPlayer.audio.src = track.url;
        nextPlayer.audio.currentTime = 0;
        
        const vol = getTargetVolume();
        const fadeTime = (settingsRef.crossfadeDuration || 0);

        if (useCrossfade && fadeTime > 0 && state.isPlaying) {
            const now = state.audioContext.currentTime;
            
            // Fade out current
            currentPlayer.gain.gain.cancelScheduledValues(now);
            currentPlayer.gain.gain.setValueAtTime(currentPlayer.gain.gain.value, now);
            currentPlayer.gain.gain.linearRampToValueAtTime(0.01, now + fadeTime);
            setTimeout(() => currentPlayer.audio.pause(), fadeTime * 1000 + 100);

            // Fade in next
            nextPlayer.gain.gain.cancelScheduledValues(now);
            nextPlayer.gain.gain.setValueAtTime(0.01, now);
            nextPlayer.gain.gain.linearRampToValueAtTime(vol, now + fadeTime);
        } else {
            currentPlayer.audio.pause();
            nextPlayer.gain.gain.value = vol;
        }

        nextPlayer.audio.play().catch(e => console.warn('Playback prevented', e));
        
        state.activePlayer = nextPlayerIdx;
        state.currentIndex = index;
        state.isPlaying = true;
        
        elements.btnPlay.textContent = '⏸';
        elements.nowPlayingText.textContent = track.name;
        
        renderPlaylist();
    }

    function togglePlay() {
        if (state.playlist.length === 0) return;
        if (state.currentIndex === -1) {
            playTrack(0);
            return;
        }

        initAudioContext();
        const p = players[state.activePlayer];
        
        if (state.isPlaying) {
            p.audio.pause();
            state.isPlaying = false;
            elements.btnPlay.textContent = '▶';
        } else {
            p.audio.play();
            state.isPlaying = true;
            elements.btnPlay.textContent = '⏸';
        }
    }

    function playNext() {
        if (state.playlist.length === 0) return;
        
        let nextIndex = state.currentIndex + 1;
        if (state.shuffle) {
            nextIndex = Math.floor(Math.random() * state.playlist.length);
        } else if (nextIndex >= state.playlist.length) {
            nextIndex = 0;
        }
        
        playTrack(nextIndex);
    }

    function playPrev() {
        if (state.playlist.length === 0) return;
        
        const p = players[state.activePlayer];
        if (p.audio.currentTime > 3) {
            p.audio.currentTime = 0;
            return;
        }

        let prevIndex = state.currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = state.playlist.length - 1;
        }
        playTrack(prevIndex);
    }

    function onTrackEnded() {
        if (!state.isPlaying) return;
        
        if (state.repeat === 2) {
            // Repeat one
            const p = players[state.activePlayer];
            p.audio.currentTime = 0;
            p.audio.play();
        } else if (state.repeat === 1) {
            // Repeat all
            playNext();
        } else {
            // Repeat off
            if (state.currentIndex >= state.playlist.length - 1 && !state.shuffle) {
                stopPlayback();
            } else {
                playNext();
            }
        }
    }

    function seek(e) {
        if (!state.isPlaying || state.currentIndex === -1) return;
        const rect = elements.progressFill.parentElement.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        
        const p = players[state.activePlayer];
        if (p.audio.duration) {
            p.audio.currentTime = pos * p.audio.duration;
        }
    }

    function getTargetVolume() {
        if (settingsRef.musicMuted) return 0;
        // Map 0-100 to 0-1 logarithmically or linearly. We'll do simple quadratic for better feel.
        const v = settingsRef.musicVolume / 100;
        return v * v; 
    }

    function updateVolume() {
        if (!state.audioContext) return;
        
        const vol = getTargetVolume();
        elements.volIcon.textContent = settingsRef.musicMuted ? '🔇' : '🔊';
        elements.volSlider.value = settingsRef.musicVolume;
        
        const p = players[state.activePlayer];
        if (p && p.gain) {
            const now = state.audioContext.currentTime;
            p.gain.gain.cancelScheduledValues(now);
            p.gain.gain.setValueAtTime(p.gain.gain.value, now);
            p.gain.gain.linearRampToValueAtTime(vol, now + 0.1);
        }
    }

    function toggleShuffle() {
        state.shuffle = !state.shuffle;
        elements.btnShuffle.classList.toggle('active', state.shuffle);
    }

    function toggleRepeat() {
        state.repeat = (state.repeat + 1) % 3;
        elements.btnRepeat.classList.remove('active');
        elements.btnRepeat.textContent = '↻';
        
        if (state.repeat === 1) {
            elements.btnRepeat.classList.add('active');
        } else if (state.repeat === 2) {
            elements.btnRepeat.classList.add('active');
            elements.btnRepeat.textContent = '🔂';
        }
    }

    function updateLoop() {
        if (state.isPlaying && state.currentIndex !== -1) {
            const p = players[state.activePlayer];
            const current = p.audio.currentTime || 0;
            const total = p.audio.duration || 1;
            
            elements.progressFill.style.width = `${(current / total) * 100}%`;
            elements.timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
        }
        
        requestAnimationFrame(updateLoop);
    }

    function toggle() {
        state.minimized = !state.minimized;
        if (state.minimized) {
            elements.wrapper.classList.add('mp-minimized');
        } else {
            elements.wrapper.classList.remove('mp-minimized');
        }
    }

    function dispose() {
        if (elements.wrapper && elements.wrapper.parentNode) {
            elements.wrapper.parentNode.removeChild(elements.wrapper);
        }
        state.playlist.forEach(track => URL.revokeObjectURL(track.url));
        if (state.audioContext) {
            state.audioContext.close();
        }
    }

    // Initialize
    buildUI();

    return {
        toggle,
        dispose
    };
}

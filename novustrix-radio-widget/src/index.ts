// Novustrix Radio Widget - Main TypeScript file
// A Matrix widget that transforms a room into a tunable radio station

import { WidgetApi } from 'matrix-widget-api';
import { RadioBrowserApi, StationSearchType, Station, CountryResult, TagResult } from 'radio-browser-api';
import { StationSearchType as SST } from 'radio-browser-api';

// Type for the search type that matches the API
type SearchType = keyof typeof SST;

// Global state
let currentStation: Station | null = null;
let stations: Station[] = [];
let currentPage = 1;
let totalPages = 1;
let audioPlayer: HTMLAudioElement;
let radioApi: RadioBrowserApi;
let widgetApi: WidgetApi;
let isPlaying = false;
let currentSearchType: SearchType = 'byName';
let currentSearchTerm = '';
let countries: CountryResult[] = [];
let tags: TagResult[] = [];

// DOM elements
let searchInput: HTMLInputElement;
let searchTypeSelect: HTMLSelectElement;
let searchBtn: HTMLButtonElement;
let countryFilter: HTMLSelectElement;
let genreFilter: HTMLSelectElement;
let limitSelect: HTMLSelectElement;
let stationList: HTMLDivElement;
let loadingIndicator: HTMLDivElement;
let errorMessage: HTMLDivElement;
let currentStationDisplay: HTMLHeadingElement;
let currentMetadata: HTMLParagraphElement;
let playBtn: HTMLButtonElement;
let stopBtn: HTMLButtonElement;
let prevBtn: HTMLButtonElement;
let nextBtn: HTMLButtonElement;
let volumeSlider: HTMLInputElement;
let totalStationsDisplay: HTMLSpanElement;
let onlineStationsDisplay: HTMLSpanElement;
let pagination: HTMLDivElement;

// Initialize the widget
async function initWidget() {
    try {
        // Initialize Matrix Widget API
        widgetApi = new WidgetApi();
        
        // Set up widget API event handlers
        widgetApi.on('ready', () => {
            console.log('Widget API is ready');
        });
        
        widgetApi.on('error', (error: Error) => {
            console.error('Widget API error:', error);
            showError(`Matrix Widget Error: ${error.message}`);
        });
        
        // Initialize Radio Browser API
        radioApi = new RadioBrowserApi('Novustrix Radio Widget', true);
        
        // Cache DOM elements
        cacheDOMElements();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        await loadCountries();
        await loadTags();
        await loadStations();
        
        console.log('Novustrix Radio Widget initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize widget:', error);
        showError(`Failed to initialize widget: ${error}`);
    }
}

// Cache DOM elements
function cacheDOMElements() {
    searchInput = document.getElementById('searchInput') as HTMLInputElement;
    searchTypeSelect = document.getElementById('searchType') as HTMLSelectElement;
    searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;
    countryFilter = document.getElementById('countryFilter') as HTMLSelectElement;
    genreFilter = document.getElementById('genreFilter') as HTMLSelectElement;
    limitSelect = document.getElementById('limit') as HTMLSelectElement;
    stationList = document.getElementById('stationList') as HTMLDivElement;
    loadingIndicator = document.getElementById('loadingIndicator') as HTMLDivElement;
    errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
    currentStationDisplay = document.getElementById('currentStation') as HTMLHeadingElement;
    currentMetadata = document.getElementById('currentMetadata') as HTMLParagraphElement;
    playBtn = document.getElementById('playBtn') as HTMLButtonElement;
    stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    prevBtn = document.getElementById('prevBtn') as HTMLButtonElement;
    nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;
    volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
    totalStationsDisplay = document.getElementById('totalStations') as HTMLSpanElement;
    onlineStationsDisplay = document.getElementById('onlineStations') as HTMLSpanElement;
    pagination = document.getElementById('pagination') as HTMLDivElement;
    audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
}

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    searchBtn.addEventListener('click', () => searchStations());
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStations();
    });
    
    // Filter changes
    countryFilter.addEventListener('change', () => loadStations());
    genreFilter.addEventListener('change', () => loadStations());
    limitSelect.addEventListener('change', () => loadStations());
    searchTypeSelect.addEventListener('change', () => {
        currentSearchType = searchTypeSelect.value as SearchType;
    });
    
    // Player controls
    playBtn.addEventListener('click', () => {
        if (currentStation) {
            playStation(currentStation);
        }
    });
    
    stopBtn.addEventListener('click', stopPlayback);
    prevBtn.addEventListener('click', playPreviousStation);
    nextBtn.addEventListener('click', playNextStation);
    
    // Volume control
    volumeSlider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        audioPlayer.volume = parseInt(target.value) / 100;
    });
    
    // Audio player events
    audioPlayer.addEventListener('play', () => {
        isPlaying = true;
        updatePlayButton();
    });
    
    audioPlayer.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayButton();
    });
    
    audioPlayer.addEventListener('ended', () => {
        isPlaying = false;
        updatePlayButton();
    });
    
    audioPlayer.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        showError(`Playback error: ${audioPlayer.error?.message || 'Unknown error'}`);
        isPlaying = false;
        updatePlayButton();
    });
}

// Load countries for filter
async function loadCountries() {
    try {
        const countryResults = await radioApi.getCountries();
        countries = countryResults;
        countries.sort((a, b) => b.stationcount - a.stationcount);
        
        countryFilter.innerHTML = '<option value="">All Countries</option>';
        countries.slice(0, 50).forEach(country => {
            const option = document.createElement('option');
            option.value = country.name;
            option.textContent = `${country.name} (${country.stationcount})`;
            countryFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load countries:', error);
    }
}

// Load tags/genres for filter
async function loadTags() {
    try {
        const tagResults = await radioApi.getTags();
        tags = tagResults.sort((a, b) => b.stationcount - a.stationcount);
        
        genreFilter.innerHTML = '<option value="">All Genres</option>';
        tags.slice(0, 50).forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.name;
            option.textContent = `${tag.name} (${tag.stationcount})`;
            genreFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load tags:', error);
    }
}

// Load stations based on current filters
async function loadStations(page: number = 1) {
    try {
        currentPage = page;
        showLoading(true);
        clearError();
        
        // Build query based on filters
        const limit = parseInt(limitSelect.value);
        const offset = (page - 1) * limit;
        
        let query: any = {
            limit: limit,
            offset: offset,
            hideBroken: true,
            order: 'votes',
            reverse: true
        };
        
        // Apply country filter
        if (countryFilter.value) {
            query.country = countryFilter.value;
        }
        
        // Apply genre/tag filter
        if (genreFilter.value) {
            query.tag = genreFilter.value;
        }
        
        // Execute search
        const result = await radioApi.getStationsBy(currentSearchType, currentSearchTerm, query);
        
        stations = result;
        totalPages = Math.ceil(result.length / limit) || 1;
        
        updateStationList();
        updatePagination();
        updateStats();
        
        showLoading(false);
        
    } catch (error) {
        console.error('Failed to load stations:', error);
        showError(`Failed to load stations: ${error}`);
        showLoading(false);
    }
}

// Search stations
function searchStations() {
    currentSearchTerm = searchInput.value.trim();
    currentSearchType = searchTypeSelect.value as SearchType;
    currentPage = 1;
    loadStations(1);
}

// Update station list display
function updateStationList() {
    stationList.innerHTML = '';
    
    if (stations.length === 0) {
        stationList.innerHTML = '<p style="text-align: center; color: var(--matrix-secondary-text, #666); padding: 20px;">No stations found. Try adjusting your filters.</p>';
        return;
    }
    
    const limit = parseInt(limitSelect.value);
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, stations.length);
    const pageStations = stations.slice(startIndex, endIndex);
    
    pageStations.forEach((station, index) => {
        const stationItem = createStationItem(station, startIndex + index);
        stationList.appendChild(stationItem);
    });
}

// Create station item element
function createStationItem(station: Station, index: number): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'station-item' + (currentStation?.id === station.id ? ' playing' : '');
    
    // Extract first letter for icon
    const iconLetter = station.name.charAt(0).toUpperCase();
    
    item.innerHTML = `
        <div class="station-icon">${iconLetter}</div>
        <div class="station-info">
            <h4>${escapeHtml(station.name)}</h4>
            <p>${escapeHtml(station.tags?.join(', ') || 'No description')}</p>
        </div>
        <div class="station-meta">
            <span>📍 ${escapeHtml(station.country || 'Unknown')}</span>
            <span>🎧 ${station.votes || 0} votes</span>
            <span>📊 ${station.bitrate || '?'} kbps</span>
        </div>
        <div class="station-actions">
            <button onclick="playStationFromDOM('${station.id}')">Play</button>
        </div>
    `;
    
    // Add click handler to play station
    item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName !== 'BUTTON') {
            playStation(station);
        }
    });
    
    return item;
}

// Play station from DOM event
(window as any).playStationFromDOM = (stationId: string) => {
    const station = stations.find(s => s.id === stationId);
    if (station) {
        playStation(station);
    }
};

// Play a station
function playStation(station: Station) {
    if (currentStation?.id === station.id && isPlaying) {
        return; // Already playing this station
    }
    
    currentStation = station;
    isPlaying = true;
    
    // Update UI
    updateNowPlaying();
    updateStationList();
    updatePlayButton();
    
    // Set audio source
    const streamUrl = station.urlResolved || station.url;
    if (!streamUrl) {
        showError('No stream URL available for this station');
        return;
    }
    
    audioPlayer.src = streamUrl;
    audioPlayer.volume = parseInt(volumeSlider.value) / 100;
    
    // Try to play
    const playPromise = audioPlayer.play();
    
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log('Playback started');
                // Send Matrix event about station change
                if (widgetApi) {
                    sendStationUpdate(station);
                }
            })
            .catch((error) => {
                console.error('Playback failed:', error);
                showError(`Playback failed: ${error}`);
                isPlaying = false;
                updatePlayButton();
            });
    }
}

// Stop playback
function stopPlayback() {
    audioPlayer.pause();
    audioPlayer.src = '';
    isPlaying = false;
    currentStation = null;
    updateNowPlaying();
    updateStationList();
    updatePlayButton();
}

// Play previous station
function playPreviousStation() {
    if (!currentStation || stations.length === 0) return;
    
    const currentIndex = stations.findIndex(s => s.id === currentStation?.id);
    if (currentIndex > 0) {
        playStation(stations[currentIndex - 1]);
    } else if (currentPage > 1) {
        loadStations(currentPage - 1).then(() => {
            const lastIndex = stations.length - 1;
            if (lastIndex >= 0) {
                playStation(stations[lastIndex]);
            }
        });
    }
}

// Play next station
function playNextStation() {
    if (!currentStation || stations.length === 0) return;
    
    const currentIndex = stations.findIndex(s => s.id === currentStation?.id);
    const limit = parseInt(limitSelect.value);
    const endIndex = Math.min(currentPage * limit, stations.length);
    
    if (currentIndex < endIndex - 1) {
        playStation(stations[currentIndex + 1]);
    } else if (currentPage < totalPages) {
        loadStations(currentPage + 1).then(() => {
            if (stations.length > 0) {
                playStation(stations[0]);
            }
        });
    }
}

// Update now playing display
function updateNowPlaying() {
    if (currentStation) {
        currentStationDisplay.textContent = currentStation.name;
        currentMetadata.textContent = `${currentStation.country || 'Unknown'} • ${currentStation.tags?.join(', ') || 'No tags'} • ${currentStation.bitrate || '?'} kbps`;
    } else {
        currentStationDisplay.textContent = 'Select a station to play';
        currentMetadata.textContent = '';
    }
}

// Update play button state
function updatePlayButton() {
    playBtn.disabled = !currentStation || isPlaying;
    stopBtn.disabled = !isPlaying;
    prevBtn.disabled = !currentStation;
    nextBtn.disabled = !currentStation;
    
    playBtn.textContent = isPlaying ? '⏸️' : '▶️';
}

// Update pagination
function updatePagination() {
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => loadStations(currentPage - 1));
    pagination.appendChild(prevButton);
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        const firstPageButton = document.createElement('button');
        firstPageButton.textContent = '1';
        firstPageButton.addEventListener('click', () => loadStations(1));
        pagination.appendChild(firstPageButton);
        
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i.toString();
        pageButton.className = i === currentPage ? 'current-page' : '';
        pageButton.addEventListener('click', () => loadStations(i));
        pagination.appendChild(pageButton);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
        
        const lastPageButton = document.createElement('button');
        lastPageButton.textContent = totalPages.toString();
        lastPageButton.addEventListener('click', () => loadStations(totalPages));
        pagination.appendChild(lastPageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next →';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => loadStations(currentPage + 1));
    pagination.appendChild(nextButton);
}

// Update statistics display
function updateStats() {
    totalStationsDisplay.textContent = stations.length.toString();
    const onlineCount = stations.filter(s => s.lastCheckOk).length;
    onlineStationsDisplay.textContent = onlineCount.toString();
}

// Send station update to Matrix room
async function sendStationUpdate(station: Station) {
    try {
        // Note: Matrix Widget API has limitations on sending events
        // For now, we'll just log the event
        const eventData = {
            msgtype: 'm.room.message',
            body: `🎵 Now playing: ${station.name} (${station.country || 'Unknown'}) - ${station.tags?.join(', ') || 'No description'}`,
            format: 'org.matrix.custom.html',
            formatted_body: `<strong>🎵 Now playing:</strong> ${escapeHtml(station.name)} <small>(${escapeHtml(station.country || 'Unknown')}) - ${escapeHtml(station.tags?.join(', ') || 'No description')}</small>`
        };
        
        console.log('Would send Matrix event:', eventData);
        // In a real implementation, you would use the widget API to send this event
        
    } catch (error) {
        console.error('Failed to send Matrix event:', error);
    }
}

// Show loading indicator
function showLoading(show: boolean) {
    loadingIndicator.style.display = show ? 'block' : 'none';
    stationList.style.display = show ? 'none' : 'grid';
}

// Show error message
function showError(message: string) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    stationList.style.display = 'none';
    loadingIndicator.style.display = 'none';
}

// Clear error message
function clearError() {
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
}

// Escape HTML to prevent XSS
function escapeHtml(text: string | undefined): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the widget when DOM is ready
document.addEventListener('DOMContentLoaded', initWidget);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initWidget,
        loadStations,
        searchStations,
        playStation,
        stopPlayback,
        playPreviousStation,
        playNextStation
    };
}

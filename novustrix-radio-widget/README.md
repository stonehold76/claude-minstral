# Novustrix Radio Widget

A Matrix widget that transforms any Matrix homeserver room into a tunable radio station. This widget uses the open-source [Radio Browser API](https://www.radio-browser.info/) to search and discover over 45,000+ internet radio stations worldwide.

## Features

- 🔍 **Search Stations**: Find stations by name, genre, country, or language
- 🎵 **Play Radio**: Stream live radio directly in your Matrix room
- 🎚️ **Player Controls**: Play, pause, stop, previous, next with volume control
- 🌍 **Global Coverage**: Access stations from over 200 countries
- 🏷️ **Rich Metadata**: View station details, tags, bitrate, and popularity
- 📊 **Filtering**: Filter by country, genre, and quality
- 📄 **Pagination**: Browse through thousands of stations
- 💬 **Matrix Integration**: Share what you're listening to in the room

## Installation

### Prerequisites

- A Matrix homeserver (Element, Synapse, etc.)
- Matrix client that supports widgets (Element Web/Desktop recommended)
- Node.js 16+ for development

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/novustrix/radio-widget.git
   cd radio-widget
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the widget**:
   ```bash
   npm run build
   ```

4. **Start a development server**:
   ```bash
   npm start
   ```

5. **Add to your Matrix room**:
   - Open your Matrix room in Element
   - Click the integration manager (four-dot icon in top-right)
   - Select "Add widget"
   - Use the URL: `http://localhost:8080`
   - Give it a name like "Novustrix Radio"
   - Save and enjoy!

## Usage

### Basic Controls

- **Search**: Type in the search box to find stations by name, genre, country, or language
- **Filters**: Use the dropdowns to filter by country or genre
- **Play**: Click on any station or use the play button
- **Navigation**: Use Previous/Next buttons to navigate through stations
- **Volume**: Adjust the volume slider

### Advanced Features

- **Pagination**: Use the pagination controls to browse through results
- **Sorting**: Results are sorted by popularity (votes) by default
- **Matrix Integration**: Station changes are shared in the room

## Development

### Project Structure

```
novustrix-radio-widget/
├── src/
│   ├── index.ts          # Main TypeScript file
│   ├── index.html        # Widget HTML template
│   └── styles.css        # Widget styles
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

### Scripts

- `npm run build`: Build production version
- `npm run dev`: Development mode with watch
- `npm start`: Start HTTP server for testing

### Customization

You can customize the widget by modifying:

- **Styles**: Edit `src/styles.css` to change the appearance
- **API**: Modify `src/index.ts` to use different radio APIs
- **Features**: Add new features like favorites, playlists, etc.

## API Integration

This widget uses two main APIs:

### Matrix Widget API

- **Purpose**: Communication with the Matrix client
- **Documentation**: [matrix-widget-api](https://github.com/matrix-org/matrix-widget-api)
- **Features**: Room integration, user authentication, event sending

### Radio Browser API

- **Purpose**: Access to radio station database
- **Documentation**: [Radio Browser API](https://api.radio-browser.info/)
- **Features**: Search, filter, and stream radio stations
- **Coverage**: 45,000+ stations from 200+ countries

## Configuration

The widget can be configured through URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `defaultCountry` | Default country filter | `?defaultCountry=Germany` |
| `defaultGenre` | Default genre filter | `?defaultGenre=Jazz` |
| `defaultVolume` | Default volume (0-100) | `?defaultVolume=80` |

## Security

- All audio streams are served over HTTPS when available
- User data is not collected or stored
- Matrix authentication is handled by the widget API
- Cross-origin requests are made through the Radio Browser API

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

## Support

- **Matrix Room**: `#novustrix-radio:matrix.org`
- **GitHub Issues**: [novustrix/radio-widget/issues](https://github.com/novustrix/radio-widget/issues)
- **Documentation**: [Radio Browser API Docs](https://api.radio-browser.info/)

## Credits

- **Radio Browser**: [https://www.radio-browser.info/](https://www.radio-browser.info/)
- **Matrix Widget API**: [https://github.com/matrix-org/matrix-widget-api](https://github.com/matrix-org/matrix-widget-api)
- **Icon**: Radio emoji from Unicode

---

**Built with ❤️ for the Matrix community by Novustrix**

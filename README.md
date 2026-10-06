# VibeColors
[![VS Code Extension CI](https://github.com/yili6ms/VibeColors/actions/workflows/ci.yml/badge.svg)](https://github.com/yili6ms/VibeColors/actions/workflows/ci.yml)
[Latest VSIX](https://github.com/yili6ms/VibeColors/releases/latest/download/vibecolors-latest.vsix)

A comprehensive VS Code theme collection featuring **21 unique themes** plus **infinite dynamic color generation**. From carefully crafted static themes to algorithmically generated palettes, VibeColors offers the ultimate customization for your coding environment.

## 🌟 Features

🎨 **21 Distinct Theme Variants** - Carefully designed themes for every mood and environment

🔀 **Shuffle Themes** - A new random playlist of themes every time VS Code starts, switched automatically or on demand

🎲 **Dynamic Theme Generation** - Infinite random color schemes with mathematical harmony

⚡ **Real-time Commands** - Generate new themes instantly with Command Palette

💾 **Palette Management** - Save, load, and organize your favorite color schemes

🌓 **Dark & Light Support** - Complete coverage for both theme preferences

🎯 **Programming Optimized** - Extensive syntax highlighting for all major languages

## 🎨 Theme Collection

### **Dark Themes**
- **VibeColors Dark** - Original enhanced theme with comprehensive UI coverage
- **High Contrast Dark** - Maximum contrast with true black backgrounds for accessibility
- **Neon Dark** - Vibrant cyberpunk aesthetics with hot pink and electric blue
- **Soft Dark** - Muted, warm colors with gentle contrasts for comfortable sessions
- **Retro Dark** - Vintage computing vibes with classic green/amber CRT colors
- **Ocean Dark** - Deep blues with aqua highlights inspired by calm coastal palettes

### **Light Themes**
- **VibeColors Light** - Clean, professional light theme with excellent readability
- **Minimal Light** - Ultra-clean design with subtle grays and minimal color
- **Pastel Light** - Soft purple/pink backgrounds with gentle, artistic pastels
- **Corporate Light** - Business-appropriate blues and grays for professional environments
- **Sunset Light** - Warm peach and coral hues reminiscent of late-evening light

### **Dynamic Themes**
- **Dynamic Dark** - Algorithmically generated dark themes with infinite variety
- **Dynamic Light** - Mathematically harmonious light themes, unique every time
- **Dynamic Vivid Dark/Light** - Higher saturation accents and punchier contrast
- **Dynamic Muted Dark/Light** - Softer saturation for a calmer look

### **Auto Themes**
- **Auto Dark / Auto Light** - Automatically rotate their colors every 10 minutes by default. Adjust the cadence with the `vibeColors.autoThemePeriodMinutes` setting.

### **Shuffle Themes**
- **Shuffle Dark / Shuffle Light** - Play a shuffled playlist of complete themes and switch to the next one every 10 minutes by default (`vibeColors.shuffle.intervalMinutes`, `0` = only on demand). Every VS Code start picks a new random session seed, which sets the order and the random palettes, so each session opens on a different theme. All open windows share one session: windows opened (or reloaded) later join it, and the theme switches once per interval no matter how many windows are open.

The playlist mixes these sources (choose them with `vibeColors.shuffle.sources`):

| Source | What it adds |
| --- | --- |
| `builtinThemes` | The static VibeColors themes above (Neon, Ocean, Pastel, ...) |
| `themeFiles` | Your own VS Code color theme JSON files or folders from `vibeColors.shuffle.themeFiles` |
| `builtinSeeds` | Curated, pre-generated palette seeds (e.g. *Lagoon*, *Ember*, *Glacier*) chosen for contrast and hue variety |
| `seeds` | Your own seeds from `vibeColors.shuffle.seeds`, e.g. `"2b3bb345"` or `"2b3bb345:vivid"` |
| `savedPalettes` | Palettes saved with `VibeColors: Save Current Palette` |
| `random` | `vibeColors.shuffle.randomCount` palettes generated from the session seed at startup |

Only entries matching the theme's variant are used: Shuffle Dark plays dark themes and Shuffle Light plays light ones. Your own theme files are classified by their `type` or editor background, may contain comments, and can `include` other JSON themes.

Switch at runtime with the status bar item or these commands:
- `VibeColors: Shuffle: Next Theme` - Skip to the next theme now (also switches to a Shuffle theme if you are not using one)
- `VibeColors: Shuffle: Pick Theme...` - Browse the playlist; arrow keys preview, Enter switches, Escape restores
- `VibeColors: Shuffle: Reshuffle With New Random Seed` - New order and new random palettes
- `VibeColors: Switch Dark/Light Variant` - Toggle between Shuffle Dark and Shuffle Light
- `VibeColors: Save Current Palette` - Keep the generated palette that is showing (theme-file entries have no seed to save)

To replay a session, set `vibeColors.shuffle.sessionSeed` to the seed shown in the status bar tooltip. Setting a fixed seed restarts its sequence right away; setting it back to `0` takes effect on the next start.

## 🚀 Dynamic Theme System

### **Instant Generation**
Use Command Palette (`Ctrl+Shift+P`) for:
- `VibeColors: Refresh Dynamic Theme` - New colors for current variant
- `VibeColors: Generate New Dark Theme` - Force new dark theme
- `VibeColors: Generate New Light Theme` - Force new light theme
- `VibeColors: Switch Dark/Light Variant` - Toggle with fresh colors

### **Auto-Refresh**
Set `vibeColors.autoRefreshInterval` (minutes) to periodically refresh the active dynamic theme.

### **Palette Management**
- `VibeColors: Save Current Palette` - Save favorite color schemes
- `VibeColors: Load Saved Palette` - Browse and restore saved palettes

### **Smart Color Generation**
- **Golden Ratio Harmony** - Uses 137.508° intervals for naturally pleasing relationships
- **Complementary & Triadic** - Mathematically perfect color combinations
- **Semantic Consistency** - Errors stay red, success stays green, etc.
- **Proper Contrast** - Automatic readability optimization for dark/light modes

## 📦 Installation

### **From VS Code Marketplace**
1. Open **Extensions** sidebar panel in VS Code (`Ctrl+Shift+X`)
2. Search for `VibeColors`
3. Click **Install**
4. Select your preferred theme from **File > Preferences > Color Theme**

### **Manual Installation**
1. Download the latest VSIX: [vibecolors-latest.vsix](https://github.com/yili6ms/VibeColors/releases/latest/download/vibecolors-latest.vsix)
2. Install with:
```bash
code --install-extension vibecolors-latest.vsix
```

### **First Use**
- Extension auto-activates with a random dynamic theme
- Use Command Palette (`Ctrl+Shift+P`) → "VibeColors" to explore features
- Switch between 21 built-in themes or generate infinite dynamic ones

## 🎯 What's Enhanced

### **Complete UI Coverage**
- **Editor**: Advanced highlighting, selections, brackets, rulers, gutters
- **Sidebar**: Explorer, search, source control with consistent theming
- **Activity Bar**: Icons, badges, and hover states
- **Status Bar**: Comprehensive information bar styling
- **Tabs**: Active/inactive states with borders and hover effects
- **Terminal**: Full ANSI color support with semantic highlighting
- **Panels**: Debug, problems, output, and integrated terminal panels
- **Minimap**: Code overview with proper contrast and highlights
- **Settings**: Form controls, dropdowns, and configuration UI
- **Notifications**: Toast messages and notification center
- **Extensions**: Buttons, listings, and marketplace integration

### **Advanced Syntax Highlighting**
- **Universal Language Support**: JavaScript, TypeScript, Python, Go, Rust, Java, C/C++, PHP, and more
- **Semantic Tokens**: Functions, classes, variables, types with distinct colors
- **Framework Support**: React/Vue components, decorators, annotations
- **Configuration Files**: JSON, YAML, XML, Docker, shell scripts
- **Documentation**: Markdown with proper heading hierarchy and code blocks
- **Version Control**: Git diff highlighting and blame annotations

### **Accessibility Features**
- **High Contrast Option**: True black backgrounds with maximum contrast
- **Proper WCAG Compliance**: Color combinations tested for readability
- **Error/Warning Distinction**: Clear visual hierarchy for different message types
- **Focus Indicators**: Keyboard navigation support with visible focus states

## 🎨 Color Generation Examples

Each dynamic generation creates unique combinations:

### **Purple Harmony** 💜
- **Base**: Deep purple backgrounds with gold accents
- **Syntax**: Cyan functions, magenta keywords, lime strings
- **Feel**: Creative, artistic, inspiring

### **Ocean Depths** 🌊
- **Base**: Deep blue backgrounds with coral highlights
- **Syntax**: Turquoise classes, pearl variables, seafoam comments
- **Feel**: Calm, flowing, serene

### **Earth Tones** 🌍
- **Base**: Warm brown backgrounds with terracotta accents
- **Syntax**: Sage functions, amber keywords, rust strings
- **Feel**: Natural, grounded, stable

### **Neon Nights** ⚡
- **Base**: Dark backgrounds with electric highlights
- **Syntax**: Hot pink keywords, lime functions, cyan operators
- **Feel**: Energetic, modern, vibrant

## 🛠️ Development & Customization

### **Extension Settings**
```json
{
  "vibeColors.persistSeed": false,            // Remember seeds between sessions
  "vibeColors.autoRefreshInterval": 0,        // Auto-refresh minutes for Dynamic themes (0 = disabled)
  "vibeColors.autoThemePeriodMinutes": 10,    // Rotation cadence for the Auto themes
  "vibeColors.savedPalettes": [],             // Your saved color schemes
  "vibeColors.shuffle.intervalMinutes": 10,   // Shuffle switch cadence (0 = on demand only)
  "vibeColors.shuffle.sessionSeed": 0,        // 0 = new random order every start; or a fixed seed
  "vibeColors.shuffle.sources": ["builtinThemes", "themeFiles", "builtinSeeds", "seeds", "savedPalettes", "random"],
  "vibeColors.shuffle.randomCount": 4,        // Random palettes generated per session
  "vibeColors.shuffle.seeds": [],             // e.g. ["2b3bb345", "d064178e:vivid"]
  "vibeColors.shuffle.themeFiles": []         // e.g. ["~/themes", "${workspaceFolder}/my-theme.json"]
}
```

### **Seed-Based Generation**
- Every theme has a unique seed number (shown in generation message)
- Same seed = same colors (reproducible and shareable)
- Save seeds of favorite combinations
- Share hex seeds with teammates for consistent project themes

### **Build From Source**
```bash
git clone https://github.com/yili6ms/VibeColors.git
cd VibeColors
npm install
npm run compile
npx vsce package
```

> **Heads up for contributors:** `npm install` installs a `pre-push` hook
> (`.githooks/pre-push`) that bumps the patch version in `package.json` and
> commits it before every push. The first push of a new change will abort with
> exit 1 after creating the bump commit — just run `git push` again to include
> both commits. Set `VIBECOLORS_SKIP_VERSION_BUMP=1` or `CI=true` in your
> environment to skip the hook.

## 💡 Tips & Workflows

### **Daily Fresh Start**
```
1. Open VS Code
2. Ctrl+Shift+P → "VibeColors: Refresh Dynamic Theme"
3. New colors for the day!
```

### **Project-Based Themes**
```
1. Start new project
2. Generate theme that matches project mood
3. Save palette with project name
4. Reload saved palette when working on project
```

### **Team Synchronization**
```
1. Generate team theme
2. Share seed number in team chat
3. Everyone uses same seed for consistent experience
4. Save as "Team Theme" in palette library
```

## 🌟 What Makes VibeColors Special

- **21 Built-in Themes** - Each with distinct personality and use case
- **Infinite Dynamic Generation** - Mathematical color harmony algorithms
- **Real-time Application** - Instant theme switching with no restart required
- **Palette Management** - Save, organize, and share favorite combinations
- **Universal Language Support** - Comprehensive syntax highlighting
- **Accessibility First** - High contrast options and WCAG compliance
- **Professional Quality** - Production-ready themes for all environments

## 📞 Support & Feedback

- **GitHub Issues**: [Report bugs or request features](https://github.com/yili6ms/VibeColors/issues)
- **Marketplace Reviews**: Rate and review to help others discover VibeColors
- **Community**: Share your favorite generated palettes and seeds

## 📄 License

Released under the MIT License. See [LICENSE](LICENSE) for details.

---

**Transform your VS Code into an ever-changing, beautiful coding environment!** 🎨✨

*VibeColors v1.0.1 - Where code meets art* 🚀

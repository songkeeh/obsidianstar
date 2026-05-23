import { Plugin, TFile, PluginSettingTab, Setting, App } from 'obsidian';

const DEFAULT_SETTINGS = {
  colorCreated: '#22c55e',
  colorModified: '#eab308',
  markerShape: '★',
  markerPosition: 'after',
  createdDurationHours: 24,
  modifiedDurationHours: 24,
  refreshSeconds: 15,
  titleStyle: 'none',
  titleColorCreated: '#22c55e',
  titleColorModified: '#eab308',
  showMarkerIcon: true,
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

declare const moment: { locale: () => string };

type Locale = 'ko' | 'en';

function getLocale(): Locale {
  return moment.locale().startsWith('ko') ? 'ko' : 'en';
}

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  ko: {
    colorCreatedName: '신규 생성 색상',
    colorCreatedDesc: '기준 시간 이내 생성된 파일의 마커 색상',
    colorModifiedName: '수정 파일 색상',
    colorModifiedDesc: '기준 시간 이내 수정된 파일의 마커 색상',
    markerShapeName: '마커 모양',
    markerShapeDesc: '파일명 옆에 표시할 마커 문자',
    markerPositionName: '마커 위치',
    markerPositionDesc: '파일명 기준 마커 위치',
    positionBefore: '앞 (before)',
    positionAfter: '뒤 (after)',
    createdDurationHoursName: '신규 생성 기준 시간',
    createdDurationHoursDesc: '이 시간 이내에 생성된 파일에 마커 표시 (시간 단위)',
    modifiedDurationHoursName: '수정 기준 시간',
    modifiedDurationHoursDesc: '이 시간 이내에 수정된 파일에 마커 표시 (시간 단위)',
    refreshSecondsName: '재검사 주기',
    refreshSecondsDesc: '파일 목록을 다시 검사하는 주기 (초 단위, 변경 후 플러그인 토글 필요)',
    titleStyleName: '제목 스타일',
    titleStyleDesc: '최근 파일 제목에 적용할 시각적 스타일',
    styleNone: '없음 (none)',
    styleBold: '굵게 (bold)',
    styleColor: '색상 (color)',
    styleHighlight: '하이라이트 (highlight)',
    styleBoldColor: '굵게+색상 (bold+color)',
    titleColorCreatedName: '생성 파일 제목 색상',
    titleColorCreatedDesc: '제목 스타일이 color, bold+color, highlight일 때 사용',
    titleColorModifiedName: '수정 파일 제목 색상',
    titleColorModifiedDesc: '제목 스타일이 color, bold+color, highlight일 때 사용',
    showMarkerIconName: '마커 아이콘 표시',
    showMarkerIconDesc: '비활성화하면 아이콘 없이 제목 스타일만 적용',
  },
  en: {
    colorCreatedName: 'New file color',
    colorCreatedDesc: 'Marker color for files created within the threshold',
    colorModifiedName: 'Modified file color',
    colorModifiedDesc: 'Marker color for files modified within the threshold',
    markerShapeName: 'Marker shape',
    markerShapeDesc: 'Character displayed next to the filename',
    markerPositionName: 'Marker position',
    markerPositionDesc: 'Position of the marker relative to the filename',
    positionBefore: 'Before',
    positionAfter: 'After',
    createdDurationHoursName: 'New file threshold (hours)',
    createdDurationHoursDesc: 'Show marker on files created within this many hours',
    modifiedDurationHoursName: 'Modified file threshold (hours)',
    modifiedDurationHoursDesc: 'Show marker on files modified within this many hours',
    refreshSecondsName: 'Refresh interval (seconds)',
    refreshSecondsDesc: 'How often to re-check file recency (requires plugin toggle to take effect)',
    titleStyleName: 'Title style',
    titleStyleDesc: 'Visual style applied to filenames of recent files',
    styleNone: 'None',
    styleBold: 'Bold',
    styleColor: 'Color',
    styleHighlight: 'Highlight',
    styleBoldColor: 'Bold + Color',
    titleColorCreatedName: 'Created file title color',
    titleColorCreatedDesc: 'Used when title style is color, bold+color, or highlight',
    titleColorModifiedName: 'Modified file title color',
    titleColorModifiedDesc: 'Used when title style is color, bold+color, or highlight',
    showMarkerIconName: 'Show marker icon',
    showMarkerIconDesc: 'When off, only the title style is applied without the marker icon',
  },
};

type PluginSettings = typeof DEFAULT_SETTINGS;

const MARKER_CLASS = 'file-recency-star';

export default class FileRecencyStarPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  private debounceTimer: number | null = null;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new FileRecencySettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.decorateAll());

    this.registerEvent(this.app.vault.on('create', () => this.scheduleDecorate()));
    this.registerEvent(this.app.vault.on('modify', () => this.scheduleDecorate()));
    this.registerEvent(this.app.vault.on('rename', () => this.scheduleDecorate()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleDecorate()));

    this.registerInterval(
      window.setInterval(() => this.decorateAll(), this.settings.refreshSeconds * 1000)
    );
  }

  onunload() {
    document.querySelectorAll('.' + MARKER_CLASS).forEach((el) => el.remove());
    document.querySelectorAll('.nav-file-title-content').forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.fontWeight = '';
      htmlEl.style.color = '';
      htmlEl.style.backgroundColor = '';
    });
  }

  async loadSettings() {
    const loaded = await this.loadData();
    if (loaded) {
      this.settings = { ...DEFAULT_SETTINGS, ...loaded };
    } else {
      this.settings = { ...DEFAULT_SETTINGS };
      await this.saveData(this.settings);
    }
  }

  private scheduleDecorate() {
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.decorateAll(), 300);
  }

  decorateAll() {
    const now = Date.now();
    const createdMs = this.settings.createdDurationHours * 3600000;
    const modifiedMs = this.settings.modifiedDurationHours * 3600000;
    const titleEls = document.querySelectorAll('.nav-file-title');

    titleEls.forEach((el) => {
      const path = el.getAttribute('data-path');
      const old = el.querySelector('.' + MARKER_CLASS);
      if (old) old.remove();

      const contentEl = el.querySelector('.nav-file-title-content') as HTMLElement | null;
      if (contentEl) {
        contentEl.style.fontWeight = '';
        contentEl.style.color = '';
        contentEl.style.backgroundColor = '';
      }

      if (!path) return;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;

      const createdAge = now - file.stat.ctime;
      const modifiedAge = now - file.stat.mtime;

      let markerColor: string | null = null;
      let titleColor: string | null = null;
      if (createdAge < createdMs) {
        markerColor = this.settings.colorCreated;
        titleColor = this.settings.titleColorCreated;
      } else if (modifiedAge < modifiedMs) {
        markerColor = this.settings.colorModified;
        titleColor = this.settings.titleColorModified;
      }

      if (markerColor) {
        if (this.settings.showMarkerIcon) {
          const marker = document.createElement('span');
          marker.className = MARKER_CLASS;
          marker.textContent = this.settings.markerShape;
          marker.style.color = markerColor;
          marker.style.flexShrink = '0';

          if (this.settings.markerPosition === 'before') {
            marker.style.marginRight = '4px';
            (el as HTMLElement).prepend(marker);
          } else {
            marker.style.marginLeft = '4px';
            (el as HTMLElement).append(marker);
          }
        }

        if (contentEl && titleColor && this.settings.titleStyle !== 'none') {
          switch (this.settings.titleStyle) {
            case 'bold':
              contentEl.style.fontWeight = 'bold';
              break;
            case 'color':
              contentEl.style.color = titleColor;
              break;
            case 'highlight':
              contentEl.style.backgroundColor = hexToRgba(titleColor, 0.15);
              break;
            case 'bold+color':
              contentEl.style.fontWeight = 'bold';
              contentEl.style.color = titleColor;
              break;
          }
        }
      }
    });
  }
}

class FileRecencySettingTab extends PluginSettingTab {
  private plugin: FileRecencyStarPlugin;

  constructor(app: App, plugin: FileRecencyStarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const t = TRANSLATIONS[getLocale()];

    new Setting(containerEl)
      .setName(t.colorCreatedName)
      .setDesc(t.colorCreatedDesc)
      .addColorPicker((color) =>
        color
          .setValue(this.plugin.settings.colorCreated)
          .onChange(async (value) => {
            this.plugin.settings.colorCreated = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );

    new Setting(containerEl)
      .setName(t.colorModifiedName)
      .setDesc(t.colorModifiedDesc)
      .addColorPicker((color) =>
        color
          .setValue(this.plugin.settings.colorModified)
          .onChange(async (value) => {
            this.plugin.settings.colorModified = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );

    new Setting(containerEl)
      .setName(t.markerShapeName)
      .setDesc(t.markerShapeDesc)
      .addDropdown((drop) =>
        drop
          .addOption('★', '★')
          .addOption('❗', '❗')
          .addOption('●', '●')
          .addOption('🔥', '🔥')
          .addOption('✦', '✦')
          .setValue(this.plugin.settings.markerShape)
          .onChange(async (value) => {
            this.plugin.settings.markerShape = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );

    new Setting(containerEl)
      .setName(t.markerPositionName)
      .setDesc(t.markerPositionDesc)
      .addDropdown((drop) =>
        drop
          .addOption('before', t.positionBefore)
          .addOption('after', t.positionAfter)
          .setValue(this.plugin.settings.markerPosition)
          .onChange(async (value) => {
            this.plugin.settings.markerPosition = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );

    new Setting(containerEl)
      .setName(t.showMarkerIconName)
      .setDesc(t.showMarkerIconDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showMarkerIcon)
          .onChange(async (value) => {
            this.plugin.settings.showMarkerIcon = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );

    new Setting(containerEl)
      .setName(t.createdDurationHoursName)
      .setDesc(t.createdDurationHoursDesc)
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.createdDurationHours))
          .onChange(async (value) => {
            const num = parseFloat(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.createdDurationHours = num;
              await this.plugin.saveData(this.plugin.settings);
              this.plugin.decorateAll();
            }
          })
      );

    new Setting(containerEl)
      .setName(t.modifiedDurationHoursName)
      .setDesc(t.modifiedDurationHoursDesc)
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.modifiedDurationHours))
          .onChange(async (value) => {
            const num = parseFloat(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.modifiedDurationHours = num;
              await this.plugin.saveData(this.plugin.settings);
              this.plugin.decorateAll();
            }
          })
      );

    new Setting(containerEl)
      .setName(t.refreshSecondsName)
      .setDesc(t.refreshSecondsDesc)
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.refreshSeconds))
          .onChange(async (value) => {
            const num = parseFloat(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.refreshSeconds = num;
              await this.plugin.saveData(this.plugin.settings);
              this.plugin.decorateAll();
            }
          })
      );

    new Setting(containerEl)
      .setName(t.titleStyleName)
      .setDesc(t.titleStyleDesc)
      .addDropdown((drop) =>
        drop
          .addOption('none', t.styleNone)
          .addOption('bold', t.styleBold)
          .addOption('color', t.styleColor)
          .addOption('highlight', t.styleHighlight)
          .addOption('bold+color', t.styleBoldColor)
          .setValue(this.plugin.settings.titleStyle)
          .onChange(async (value) => {
            this.plugin.settings.titleStyle = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );

    new Setting(containerEl)
      .setName(t.titleColorCreatedName)
      .setDesc(t.titleColorCreatedDesc)
      .addColorPicker((color) =>
        color
          .setValue(this.plugin.settings.titleColorCreated)
          .onChange(async (value) => {
            this.plugin.settings.titleColorCreated = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );

    new Setting(containerEl)
      .setName(t.titleColorModifiedName)
      .setDesc(t.titleColorModifiedDesc)
      .addColorPicker((color) =>
        color
          .setValue(this.plugin.settings.titleColorModified)
          .onChange(async (value) => {
            this.plugin.settings.titleColorModified = value;
            await this.plugin.saveData(this.plugin.settings);
            this.plugin.decorateAll();
          })
      );
  }
}

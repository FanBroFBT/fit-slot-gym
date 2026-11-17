import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-news',
  imports: [CommonModule],
  template: `
    <div class="container" style="padding: 30px 0; max-width: 1200px; margin: 0 auto;">
      <div style="margin-bottom: 32px; text-align: center;">
        <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 8px; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">{{ i18n.t('NEWS_MAIN_TITLE') }}</h2>
        <p style="color: #94a3b8; font-size: 1.05rem;">{{ i18n.t('NEWS_MAIN_SUBTITLE') }}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 28px;">
        @for (item of newsList(); track item.titleKey) {
          <div class="news-card">
            <div class="image-container">
              <img [src]="item.image" [alt]="i18n.t(item.titleKey)" loading="lazy">
              <span class="category-badge">{{ i18n.t(item.catKey) }}</span>
            </div>
            <div class="card-content">
              <span class="news-date">📅 {{ i18n.t(item.dateKey) }}</span>
              <h3 class="news-title">{{ i18n.t(item.titleKey) }}</h3>
              <p class="news-desc">{{ i18n.t(item.descKey) }}</p>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .news-card {
      background-color: var(--card-bg, #1e293b);
      border: 1px solid var(--border-color, #334155);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .news-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border-color: #38bdf8;
    }
    .image-container {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
    }
    .image-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }
    .news-card:hover .image-container img {
      transform: scale(1.08);
    }
    .category-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(4px);
      color: #38bdf8;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 20px;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .card-content {
      padding: 22px;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }
    .news-date {
      font-size: 0.8rem;
      color: #38bdf8;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .news-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin-bottom: 10px;
      color: var(--text-color, #f8fafc);
      line-height: 1.4;
    }
    .news-desc {
      font-size: 0.92rem;
      color: #94a3b8;
      line-height: 1.6;
      flex-grow: 1;
    }
  `
})
export class NewsComponent {
  protected i18n = inject(I18nService);

  newsList = computed(() => [
    {
      titleKey: 'NEWS_1_TITLE',
      descKey: 'NEWS_1_DESC',
      dateKey: 'NEWS_1_DATE',
      catKey: 'CAT_EQUIPMENT',
      image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2'
    },
    {
      titleKey: 'NEWS_2_TITLE',
      descKey: 'NEWS_2_DESC',
      dateKey: 'NEWS_2_DATE',
      catKey: 'CAT_SPECIAL',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48'
    },
    {
      titleKey: 'NEWS_3_TITLE',
      descKey: 'NEWS_3_DESC',
      dateKey: 'NEWS_3_DATE',
      catKey: 'CAT_CLASSES',
      image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773'
    },
    {
      titleKey: 'NEWS_4_TITLE',
      descKey: 'NEWS_4_DESC',
      dateKey: 'NEWS_4_DATE',
      catKey: 'CAT_WORKSHOP',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b'
    },
    {
      titleKey: 'NEWS_5_TITLE',
      descKey: 'NEWS_5_DESC',
      dateKey: 'NEWS_5_DATE',
      catKey: 'CAT_FACILITIES',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d'
    },
    {
      titleKey: 'NEWS_6_TITLE',
      descKey: 'NEWS_6_DESC',
      dateKey: 'NEWS_6_DATE',
      catKey: 'CAT_EVENT',
      image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed'
    },
    {
      titleKey: 'NEWS_7_TITLE',
      descKey: 'NEWS_7_DESC',
      dateKey: 'NEWS_7_DATE',
      catKey: 'CAT_HEALTH',
      image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061'
    },
    {
      titleKey: 'NEWS_8_TITLE',
      descKey: 'NEWS_8_DESC',
      dateKey: 'NEWS_8_DATE',
      catKey: 'CAT_UPDATE',
      image: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7'
    },
    {
      titleKey: 'NEWS_9_TITLE',
      descKey: 'NEWS_9_DESC',
      dateKey: 'NEWS_9_DATE',
      catKey: 'CAT_COMPITION',
      image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd'
    },
    {
      titleKey: 'NEWS_10_TITLE',
      descKey: 'NEWS_10_DESC',
      dateKey: 'NEWS_10_DATE',
      catKey: 'CAT_SCHEDULE',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48'
    }
  ]);
}
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container" style="padding: 30px 0; max-width: 1200px; margin: 0 auto;">
      <div style="margin-bottom: 32px; text-align: center;">
        <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 8px; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">📰 Club News & Special Offers</h2>
        <p style="color: #94a3b8; font-size: 1.05rem;">Stay updated with our latest gym equipment, professional masterclasses, and seasonal discounts.</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 28px;">
        @for (item of newsList(); track item.title) {
          <div class="news-card">
            <div class="image-container">
              <img [src]="item.image" [alt]="item.title" loading="lazy">
              <span class="category-badge">{{ item.category }}</span>
            </div>
            <div class="card-content">
              <span class="news-date">📅 {{ item.date }}</span>
              <h3 class="news-title">{{ item.title }}</h3>
              <p class="news-desc">{{ item.description }}</p>
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
  newsList = signal([
    {
      title: "🔥 New Premium Equipment Arrived!",
      description: "The latest line of world-class strength and cardio machines has been installed in our gym. Come and test them out today!",
      date: "May 15, 2026",
      category: "Equipment",
      image: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2"
    },
    {
      title: "🎉 Summer Season: 20% Off Memberships!",
      description: "Get a 20% discount on all 3-month and 6-month memberships until the end of May. Bring a friend and train together!",
      date: "May 10, 2026",
      category: "Special Offer",
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48"
    },
    {
      title: "🧘‍♀️ New Yoga & Pilates Classes",
      description: "Registration for our new morning and evening group sessions is now open. Limited slots available per group.",
      date: "May 5, 2026",
      category: "Classes",
      image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773"
    },
    {
      title: "💪 Professional Trainer Workshop",
      description: "Join our masterclass on proper nutrition and muscle recovery techniques this Saturday with our lead instructors.",
      date: "April 28, 2026",
      category: "Workshop",
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b"
    },
    {
      title: "🥤 Protein Bar Grand Opening",
      description: "Our brand new healthy smoothie and protein bar is officially open in the lobby. Refresh yourself after a hard workout!",
      date: "April 20, 2026",
      category: "Facilities",
      image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d"
    },
    {
      title: "🥊 Ultimate Boxing Championship Night",
      description: "Watch our club members compete in an amateur showcase match this Friday night. Free entry for all active members!",
      date: "April 15, 2026",
      category: "Event",
      image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed"
    },
    {
      title: "🍏 Free Nutritional Consultation Week",
      description: "Book a 30-minute free body composition analysis and diet planning session with our certified sports nutritionists.",
      date: "April 10, 2026",
      category: "Health",
      image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061"
    },
    {
      title: "🏊‍♂️ Indoor Pool Renovation Update",
      description: "Our swimming pool facilities have undergone a complete modern upgrade with state-of-the-art water purification systems.",
      date: "April 2, 2026",
      category: "Update",
      image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7"
    },
    {
      title: "🏆 Annual Powerlifting Tournament",
      description: "Test your strength against the best! Register now for the upcoming bench press and squat competition next month.",
      date: "March 25, 2026",
      category: "Competition",
      image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd"
    },
    {
      title: "🌙 Extended Working Hours",
      description: "Due to popular demand, our main gym facility will now stay open until midnight every Friday and Saturday.",
      date: "March 18, 2026",
      category: "Schedule",
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48"
    }
  ]);
}
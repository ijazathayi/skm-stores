'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';
import { t } from '@/lib/translations';

export default function Header({ backHref, title, showLangToggle = true }) {
  const { connected, todaySales, lang, setLang } = useStore();
  const isTa = lang === 'ta';

  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16, flexWrap: 'wrap', gap: 10, padding: '14px 16px 0',
      maxWidth: 900, margin: '0 auto'
    }}>
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {backHref ? (
          <Link href={backHref} style={{
            background: 'transparent', border: 'none', fontSize: 15, fontWeight: 700,
            color: 'var(--primary-dark)', cursor: 'pointer', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 36
          }}>
            ← {t('home', lang)}
          </Link>
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: 'var(--card)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', overflow: 'hidden', flexShrink: 0
          }}>
            <Image src="/skm-logo.png" alt="SKM Stores" width={40} height={40} style={{ objectFit: 'cover' }} />
          </div>
        )}
        <div>
          {backHref ? (
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700 }}>{title}</div>
          ) : (
            <>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700 }}>{t('appName', lang)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: connected ? '#3B8A46' : 'var(--danger)',
                  display: 'inline-block'
                }} />
                {connected ? t('syncedLive', lang) : t('offline', lang)}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {showLangToggle && (
          <div style={{
            display: 'inline-flex',
            border: '1.5px solid var(--border)',
            borderRadius: 999,
            background: 'var(--card)',
            padding: 2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: !isTa ? 'var(--primary)' : 'transparent',
                color: !isTa ? '#fff' : 'var(--ink3)',
                transition: 'all 0.15s ease'
              }}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ta')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: isTa ? 'var(--primary)' : 'transparent',
                color: isTa ? '#fff' : 'var(--ink3)',
                transition: 'all 0.15s ease'
              }}
            >
              தமிழ்
            </button>
          </div>
        )}

        <div className="stat-pill">
          <span style={{ color: 'var(--ink3)', fontSize: 12 }}>{t('todaySales', lang)}</span>
          <span style={{
            fontFamily: "'SFMono-Regular', Consolas, monospace",
            fontSize: 16, fontWeight: 700, color: 'var(--primary-dark)'
          }}>
            {money(todaySales())}
          </span>
        </div>
      </div>
    </header>
  );
}

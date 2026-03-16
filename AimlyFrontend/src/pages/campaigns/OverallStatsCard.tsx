// ============================================================
// OverallStatsCard.tsx - Slim command bar + stats strip
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeroCard, HeroCommandBar, HeroBarLeft, HeroBarRight, HeroBarTitle,
  HeroBarDate, HeroBarSep, HeroNavBtn, HeroNavBtnCount,
  HeroStatsStrip, HeroStatCell, HeroStatValue, HeroStatLabel, HeroStatRate,
} from './campaigns.styles.ts';
import type { OverallStats } from './campaigns.types';

interface OverallStatsCardProps {
  stats: OverallStats;
  theme: any;
}

const OverallStatsCard: React.FC<OverallStatsCardProps> = ({ stats, theme }) => {
  const navigate = useNavigate();

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <HeroCard theme={theme}>

      {/* ── Slim command bar ── */}
      <HeroCommandBar theme={theme}>
        <HeroBarLeft>
          <HeroBarTitle theme={theme}>Campaigns</HeroBarTitle>
          <HeroBarSep theme={theme} />
          <HeroBarDate theme={theme}>{dateLabel}</HeroBarDate>
        </HeroBarLeft>

        <HeroBarRight>
          <HeroNavBtn theme={theme} onClick={() => navigate('/history')} title="History">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            History
          </HeroNavBtn>

          <HeroNavBtn theme={theme} onClick={() => navigate('/attachments')} title="Attachments">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            Attachments
            <HeroNavBtnCount theme={theme}>{stats.total_attachments}</HeroNavBtnCount>
          </HeroNavBtn>

          <HeroNavBtn theme={theme} onClick={() => navigate('/categories')} title="Categories">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            Categories
            <HeroNavBtnCount theme={theme}>{stats.total_categories}</HeroNavBtnCount>
          </HeroNavBtn>

          <HeroNavBtn theme={theme} onClick={() => navigate('/companies')} title="Companies">
            <svg width="13" height="13" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="30" height="38" rx="2"/>
              <rect x="5" y="6" width="7" height="7" rx="0.5"/>
              <rect x="20" y="6" width="7" height="7" rx="0.5"/>
              <rect x="5" y="17" width="7" height="7" rx="0.5"/>
              <rect x="20" y="17" width="7" height="7" rx="0.5"/>
              <rect x="11" y="29" width="10" height="10" rx="1"/>
            </svg>
            Companies
            <HeroNavBtnCount theme={theme}>{stats.total_companies}</HeroNavBtnCount>
          </HeroNavBtn>
        </HeroBarRight>
      </HeroCommandBar>

      {/* ── Stats strip ── */}
      <HeroStatsStrip theme={theme}>

        <HeroStatCell theme={theme}>
          <HeroStatValue>{stats.total_campaigns}</HeroStatValue>
          <HeroStatLabel>Campaigns</HeroStatLabel>
        </HeroStatCell>

        <HeroStatCell theme={theme}>
          <HeroStatValue $color={theme.colors.success.main}>{stats.total_sent}</HeroStatValue>
          <HeroStatLabel>Sent</HeroStatLabel>
        </HeroStatCell>

        <HeroStatCell theme={theme}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <HeroStatValue $color={theme.colors.info.main}>{stats.total_read}</HeroStatValue>
            <HeroStatRate $color={theme.colors.info.main}>
              {(stats.overall_read_rate ?? 0).toFixed(1)}%
            </HeroStatRate>
          </div>
          <HeroStatLabel>Read</HeroStatLabel>
        </HeroStatCell>

        <HeroStatCell theme={theme}>
          <HeroStatValue $color={theme.colors.error.main}>{stats.total_failed}</HeroStatValue>
          <HeroStatLabel>Failed</HeroStatLabel>
        </HeroStatCell>

        <HeroStatCell theme={theme}>
          <HeroStatValue $color={theme.colors.warning.main}>{stats.total_draft}</HeroStatValue>
          <HeroStatLabel>Drafts</HeroStatLabel>
        </HeroStatCell>

        <HeroStatCell theme={theme}>
          <HeroStatValue $color={theme.colors.primary.main}>{stats.total_scheduled}</HeroStatValue>
          <HeroStatLabel>Scheduled</HeroStatLabel>
        </HeroStatCell>

      </HeroStatsStrip>
    </HeroCard>
  );
};

export default OverallStatsCard;
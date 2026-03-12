import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

const HelpIconSvg = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TooltipWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  cursor: help;
`;

// This is now Fixed positioned to float above everything in the DOM
const TooltipPortalBox = styled.div<{ theme: any }>`
  position: fixed;
  width: 240px;
  background-color: ${props => props.theme.colors.base[100]};
  color: ${props => props.theme.colors.base.content};
  border: 1px solid ${props => props.theme.colors.primary.main};
  padding: 12px;
  border-radius: ${props => props.theme.radius.box};
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  font-size: 0.85rem;
  z-index: 9999999; /* Higher than sidebar */
  pointer-events: none;
  white-space: normal;

  /* The arrow pointing right to the icon */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 100%;
    margin-top: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: transparent transparent transparent ${props => props.theme.colors.primary.main};
  }
`;

interface HelpTooltipProps {
  theme: any;
  instructions: React.ReactNode;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ theme, instructions }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      // Calculate position: Middle-left of the icon
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.left - 10 // 10px gap from icon
      });
      setIsVisible(true);
    }
  };

  return (
    <TooltipWrapper 
      ref={iconRef}
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={() => setIsVisible(false)}
    >
      <HelpIconSvg color={theme.colors.primary.main} />
      
      {isVisible && ReactDOM.createPortal(
        <TooltipPortalBox 
          theme={theme}
          style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px`,
            transform: 'translate(-100%, -50%)' // Move it to the left of the point
          }}
        >
          {instructions}
        </TooltipPortalBox>,
        document.body // This ignores all parent overflows!
      )}
    </TooltipWrapper>
  );
};
/**
 * Server Down Component for AI Aimly Pro
 * Displays when backend health check fails
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../theme/styles';

const Container = styled.div<{ theme: any }>`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: ${props => props.theme.colors.base[100]};
  color: ${props => props.theme.colors.base.content};
  padding: 2rem;

  @media (max-width: 480px) {
    padding: 1.5rem 1.25rem;
    justify-content: flex-start;
    padding-top: 4rem;
  }
`;

const IconContainer = styled.div<{ theme: any }>`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background-color: ${props => props.theme.colors.error.main}15;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;
`;

const ServerIcon = styled.div<{ theme: any }>`
  width: 60px;
  height: 60px;
  background-color: ${props => props.theme.colors.error.main};
  border-radius: 8px;
  position: relative;
  
  &::before,
  &::after {
    content: '';
    position: absolute;
    background-color: ${props => props.theme.colors.base[100]};
    border-radius: 2px;
  }
  
  &::before {
    width: 40px;
    height: 3px;
    top: 15px;
    left: 10px;
  }
  
  &::after {
    width: 20px;
    height: 3px;
    top: 25px;
    left: 10px;
  }
`;

const Title = styled.h1<{ theme: any }>`
  font-size: 2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.base.content};
  margin-bottom: 1rem;
  text-align: center;

  @media (max-width: 480px) { font-size: 1.375rem; }
`;

const Message = styled.p<{ theme: any }>`
  font-size: 1.125rem;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.8;
  text-align: center;
  max-width: 500px;
  line-height: 1.6;
  margin-bottom: 2rem;

  @media (max-width: 480px) { font-size: 0.9375rem; }
`;

const RetryButton = styled.button<{ theme: any; $isRetrying: boolean }>`
  padding: 0.875rem 2rem;
  border-radius: ${props => props.theme.radius.field};
  border: none;
  background-color: ${props => props.theme.colors.primary.main};
  color: ${props => props.theme.colors.primary.content};
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: ${props => props.$isRetrying ? 0.7 : 1};
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px ${props => props.theme.colors.primary.main}40;
  }
  
  &:disabled {
    cursor: not-allowed;
  }
`;

const StatusDot = styled.div<{ theme: any; $status: 'checking' | 'failed' }>`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 0.5rem;
  background-color: ${props => {
    switch (props.$status) {
      case 'checking': return props.theme.colors.info.main;
      case 'failed': return props.theme.colors.error.main;
      default: return props.theme.colors.base[400];
    }
  }};
  animation: ${props => props.$status === 'checking' ? 'pulse 1.5s ease-in-out infinite' : 'none'};
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const StatusText = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.7;
  margin-bottom: 1rem;
`;

const DetailsList = styled.ul<{ theme: any }>`
  text-align: left;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.8;
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 1.5rem 0;
  padding-left: 1.5rem;
  max-width: 480px;
  width: 100%;

  li { margin-bottom: 0.5rem; }

  @media (max-width: 480px) { font-size: 0.8375rem; padding-left: 1.25rem; }
`;

interface ServerDownProps {
  onRetry: () => Promise<void>;
}

const ServerDown: React.FC<ServerDownProps> = ({ onRetry }) => {
  const { theme } = useTheme();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [autoRetryIn, setAutoRetryIn] = useState<number | null>(null);

  // Auto-retry mechanism
  useEffect(() => {
    if (retryCount > 0 && retryCount < 3) {
      const countdown = 30; // 30 seconds
      setAutoRetryIn(countdown);
      
      const interval = setInterval(() => {
        setAutoRetryIn(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            handleRetry();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [retryCount]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setAutoRetryIn(null);
    
    try {
      await onRetry();
    } catch (error) {
      setRetryCount(prev => prev + 1);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusText = () => {
    if (isRetrying) return "Checking server status...";
    if (autoRetryIn !== null) return `Retrying automatically in ${autoRetryIn}s...`;
    return "Server connection failed";
  };

  const getStatusDot = (): 'checking' | 'failed' => {
    if (isRetrying) return 'checking';
    return 'failed';
  };

  return (
    <Container theme={theme}>
      <IconContainer theme={theme}>
        <ServerIcon theme={theme} />
      </IconContainer>
      
      <Title theme={theme}>
        Service Temporarily Unavailable
      </Title>
      
      <Message theme={theme}>
        We're experiencing some technical difficulties right now. 
        Our team has been notified and is working to resolve this issue as quickly as possible.
      </Message>

      <StatusText theme={theme}>
        <StatusDot theme={theme} $status={getStatusDot()} />
        {getStatusText()}
      </StatusText>

      <RetryButton
        theme={theme}
        onClick={handleRetry}
        disabled={isRetrying || autoRetryIn !== null}
        $isRetrying={isRetrying}
      >
        {isRetrying ? 'Checking...' : autoRetryIn ? `Auto-retry in ${autoRetryIn}s` : 'Try Again'}
      </RetryButton>

      <DetailsList theme={theme}>
        <li>This is likely a temporary issue that will resolve itself</li>
        <li>No data has been lost - your campaigns and settings are safe</li>
        <li>You can try refreshing the page or check back in a few minutes</li>
        <li>If the issue persists, please contact our support team</li>
      </DetailsList>
    </Container>
  );
};

export default ServerDown;
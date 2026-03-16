import React from 'react';
import { View, ScrollView, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AppContainerProps extends ViewProps {
  children: React.ReactNode;
  scrollable?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function AppContainer({ 
  children, 
  scrollable = false, 
  edges = ['top', 'bottom'],
  className,
  ...props 
}: AppContainerProps) {
  const Container = scrollable ? ScrollView : View;
  
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-slate-50" {...props}>
      <Container 
        className={`flex-1 ${className || ''}`}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}

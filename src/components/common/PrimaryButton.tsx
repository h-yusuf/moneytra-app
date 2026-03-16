import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
}

export function PrimaryButton({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  disabled,
  className,
  ...props
}: PrimaryButtonProps) {
  const variantStyles = {
    primary: 'bg-teal-600 border-teal-600',
    secondary: 'bg-slate-700 border-slate-700',
    outline: 'bg-transparent border-teal-600',
    ghost: 'bg-transparent border-transparent',
  };

  const textStyles = {
    primary: 'text-white',
    secondary: 'text-white',
    outline: 'text-teal-600',
    ghost: 'text-teal-600',
  };

  const sizeStyles = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        rounded-xl border-2 flex-row items-center justify-center gap-2
        ${isDisabled ? 'opacity-50' : 'active:opacity-80'}
        ${className || ''}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#0d9488' : '#ffffff'} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <IconSymbol 
              name={icon} 
              size={size === 'sm' ? 16 : size === 'md' ? 18 : 20} 
              color={variant === 'outline' || variant === 'ghost' ? '#0d9488' : '#ffffff'} 
            />
          )}
          <Text className={`${textStyles[variant]} ${textSizeStyles[size]} font-semibold`}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <IconSymbol 
              name={icon} 
              size={size === 'sm' ? 16 : size === 'md' ? 18 : 20} 
              color={variant === 'outline' || variant === 'ghost' ? '#0d9488' : '#ffffff'} 
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Navigation
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',

  // Tab Bar
  'square.grid.2x2.fill': 'dashboard',
  'gearshape.fill': 'settings',
  'chart.line.uptrend.xyaxis': 'trending-up',

  // Dashboard & Common
  'bell.fill': 'notifications',
  'plus.circle.fill': 'add-circle',
  'chart.bar.fill': 'bar-chart',
  'gear': 'settings',
  'clock.fill': 'schedule',
  'calendar': 'calendar-today',
  'arrow.clockwise': 'autorenew',

  // Transaction & Money
  'arrow.down.circle.fill': 'arrow-circle-down',
  'arrow.up.circle.fill': 'arrow-circle-up',
  'arrow.down': 'arrow-downward',
  'arrow.up': 'arrow-upward',
  'arrow.up.right': 'trending-up',
  'arrow.down.right': 'trending-down',
  'heart.circle.fill': 'favorite',
  'heart.fill': 'favorite',
  'cart.fill': 'shopping-cart',
  'dollarsign.circle.fill': 'monetization-on',

  // Camera & Upload
  'camera.fill': 'camera-alt',
  'photo.fill': 'photo-library',
  'doc.fill': 'description',
  'doc.text.fill': 'article',
  'pencil': 'edit',

  // Actions
  'plus': 'add',
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle.fill': 'cancel',
  'xmark': 'close',
  'trash.fill': 'delete',
  'trash': 'delete-outline',
  'square.and.arrow.up': 'share',

  // Info & Alerts
  'info.circle.fill': 'info',
  'exclamationmark.triangle.fill': 'warning',
  'lightbulb.fill': 'lightbulb',
  'questionmark.circle.fill': 'help',

  // Search & Filter
  'magnifyingglass': 'search',
  'line.3.horizontal.decrease': 'filter-list',
  'slider.horizontal.3': 'tune',

  // Theme & Settings
  'sun.max.fill': 'wb-sunny',
  'moon.fill': 'nightlight-round',
  'circle.lefthalf.filled': 'brightness-medium',
  'rectangle.portrait.and.arrow.right': 'logout',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mapped = (MAPPING as any)[name] || 'help-outline';
  return <MaterialIcons color={color} size={size} name={mapped} style={style} />;
}

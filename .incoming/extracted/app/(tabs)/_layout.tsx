import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HapticTab } from '@/components/haptic-tab';
import { useColors } from '@/hooks/use-colors';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'web' ? 10 : Math.max(insets.bottom, 8);
  const icon = (name: IconName) => ({ color, size }: { color: string; size: number }) => <MaterialIcons name={name} size={size} color={color} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: HapticTab,
        tabBarStyle: { height: 58 + bottomPadding, paddingTop: 7, paddingBottom: bottomPadding, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home-filled') }} />
      <Tabs.Screen name="treinos" options={{ title: 'Meus treinos', tabBarIcon: icon('fitness-center') }} />
      <Tabs.Screen name="progresso" options={{ title: 'Progresso', tabBarIcon: icon('show-chart') }} />
      <Tabs.Screen name="premium" options={{ title: 'Planos', tabBarIcon: icon('workspace-premium') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}

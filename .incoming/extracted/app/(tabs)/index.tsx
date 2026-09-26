import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useAppState } from '@/lib/app-state';

const yellow = '#F4C400';
const red = '#D72C2C';

function BrandHeader() {
  return <View style={styles.brandRow}><Image source={require('@/assets/images/summer-fit-logo.webp')} style={styles.logo} resizeMode="contain" /><View style={styles.notification}><MaterialIcons name="notifications-none" size={21} color="#17130A" /></View></View>;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

export default function HomeScreen() {
  const { studentName, completedThisWeek, workoutCompleted, customWorkouts } = useAppState();
  const firstName = studentName.split(' ')[0];
  const featuredWorkout = customWorkouts[0];
  const workoutCount = customWorkouts.length;
  const weekProgress = useMemo(() => `${Math.round((completedThisWeek / 5) * 100)}%` as `${number}%`, [completedThisWeek]);

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <BrandHeader />
    <View style={styles.greeting}><Text style={styles.greetingText}>Olá, {firstName}! <Text style={{ color: red }}>☀</Text></Text><Text style={styles.subtitle}>A academia que vai esquentar o seu dia.</Text></View>
    <View style={styles.location}><MaterialIcons name="location-on" size={18} color={red} /><View style={{ flex: 1 }}><Text style={styles.locationLabel}>SUMMER FIT</Text><Text style={styles.locationText}>Rua Pereira de Araujo, 83</Text></View><MaterialIcons name="chevron-right" size={20} color={red} /></View>
    <Pressable style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]} onPress={() => router.push('/workout')}><View style={styles.heroTop}><View style={styles.badge}><Text style={styles.badgeText}>SEU TREINO DE HOJE</Text></View><MaterialIcons name="sunny" size={25} color={yellow} /></View><Text style={styles.heroTitle}>{featuredWorkout?.title ?? 'Meu treino'}</Text><Text style={styles.heroMeta}>{featuredWorkout?.focus ?? 'Escolha seu foco'}  ·  {featuredWorkout?.exerciseCount ?? 0} exercícios  ·  {featuredWorkout?.duration ?? '—'}</Text><View style={styles.heroFooter}><Text style={styles.startText}>COMEÇAR AGORA</Text><View style={styles.playCircle}><MaterialIcons name="play-arrow" size={20} color="#17130A" /></View></View></Pressable>
    <View style={styles.statsRow}><View style={styles.statCard}><Text style={styles.statNumber}>{completedThisWeek}/5</Text><Text style={styles.statLabel}>treinos na semana</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: weekProgress }]} /></View></View><View style={styles.statCard}><Text style={styles.statNumber}>{workoutCompleted ? '1' : '0'}</Text><Text style={styles.statLabel}>concluído hoje</Text><Text style={styles.statFoot}>🔥 continue firme</Text></View></View>
    <SectionTitle title="Meus treinos" action="Gerenciar" onAction={() => router.push('/(tabs)/treinos')} />
    {customWorkouts.slice(0, 3).map((workout, index) => <Pressable key={workout.id} style={({ pressed }) => [styles.workoutRow, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/treinos')}><View style={[styles.workoutIcon, { backgroundColor: index === 0 ? '#FFF2A9' : '#FFE4E1' }]}><MaterialIcons name={index === 0 ? 'fitness-center' : 'bolt'} size={21} color={index === 0 ? '#8B7100' : red} /></View><View style={styles.workoutCopy}><Text style={styles.workoutName}>{workout.title}</Text><Text style={styles.workoutMeta}>{workout.focus}  ·  {workout.exerciseCount} exercícios</Text></View><MaterialIcons name="chevron-right" size={21} color="#9A8B72" /></Pressable>)}
    <Pressable style={styles.addCard} onPress={() => router.push('/(tabs)/treinos')}><View style={styles.addCircle}><MaterialIcons name="add" size={20} color="#17130A" /></View><View><Text style={styles.addTitle}>Monte seu próximo treino</Text><Text style={styles.addMeta}>Você escolhe o foco, os exercícios e a duração.</Text></View></Pressable>
    <View style={styles.mindset}><Text style={styles.quoteMark}>“</Text><Text style={styles.quote}>Aqueça o corpo. Fortaleça a mente.</Text><Text style={styles.quoteAuthor}>— Summer Fit</Text></View>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 34, gap: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 180, height: 52, backgroundColor: '#FFFFFF', borderRadius: 9 },
  notification: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF4C2', borderWidth: 1, borderColor: '#EAD17A', alignItems: 'center', justifyContent: 'center' },
  greeting: { gap: 4, marginTop: 1 },
  greetingText: { color: '#17130A', fontSize: 27, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: '#756B5C', fontSize: 14 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 15, backgroundColor: '#FFF4C2', borderWidth: 1, borderColor: '#F0D76E' },
  locationLabel: { color: '#856900', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  locationText: { color: '#453A24', fontSize: 12, fontWeight: '700', marginTop: 2 },
  heroCard: { minHeight: 210, borderRadius: 24, backgroundColor: yellow, padding: 21, overflow: 'hidden', borderWidth: 1, borderColor: '#D7A900' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { backgroundColor: '#17130A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#FFF5AB', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#17130A', fontSize: 29, fontWeight: '900', marginTop: 30, letterSpacing: -0.8 },
  heroMeta: { color: '#5E4E08', fontSize: 13, marginTop: 7, fontWeight: '700' },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  startText: { color: '#17130A', fontWeight: '900', letterSpacing: 1.1, fontSize: 12 },
  playCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#EADFB9', minHeight: 112 },
  statNumber: { color: '#17130A', fontSize: 24, fontWeight: '900' },
  statLabel: { color: '#756B5C', fontSize: 12, marginTop: 3 },
  statFoot: { color: '#3B9845', fontSize: 11, marginTop: 12, fontWeight: '800' },
  progressTrack: { height: 5, backgroundColor: '#F0E9CE', borderRadius: 10, marginTop: 14, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 10, backgroundColor: red },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  sectionTitle: { color: '#17130A', fontSize: 18, fontWeight: '900' },
  sectionAction: { color: red, fontSize: 12, fontWeight: '900' },
  workoutRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, gap: 12, borderWidth: 1, borderColor: '#EADFB9' },
  workoutIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  workoutCopy: { flex: 1, gap: 3 },
  workoutName: { color: '#17130A', fontSize: 15, fontWeight: '800' },
  workoutMeta: { color: '#8A7D69', fontSize: 12 },
  addCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 15, backgroundColor: '#FFF0EE', borderWidth: 1, borderColor: '#F0C5BF' },
  addCircle: { width: 38, height: 38, borderRadius: 14, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center' },
  addTitle: { color: '#321110', fontSize: 14, fontWeight: '900' },
  addMeta: { color: '#956B65', fontSize: 11, marginTop: 3 },
  mindset: { padding: 19, borderRadius: 18, backgroundColor: '#17130A', borderLeftWidth: 4, borderLeftColor: red },
  quoteMark: { color: yellow, fontSize: 30, lineHeight: 28, fontWeight: '900' },
  quote: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '800' },
  quoteAuthor: { color: '#F8DFA0', fontSize: 12, marginTop: 9 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});

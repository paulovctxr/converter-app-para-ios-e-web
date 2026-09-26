import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useAppState } from '@/lib/app-state';

const yellow = '#F4C400';
const red = '#D72C2C';
const defaultExercises = [
  { name: 'Supino reto', detail: '4 séries × 10 repetições', load: '60 kg', rest: '60s', icon: 'fitness-center' as const },
  { name: 'Crucifixo inclinado', detail: '3 séries × 12 repetições', load: '10 kg', rest: '45s', icon: 'accessibility-new' as const },
  { name: 'Tríceps corda', detail: '4 séries × 12 repetições', load: '25 kg', rest: '45s', icon: 'sports-gymnastics' as const },
];

export default function WorkoutsScreen() {
  const { customWorkouts, addWorkout } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [exerciseCount, setExerciseCount] = useState('3');
  const [duration, setDuration] = useState('45 min');

  const saveWorkout = () => {
    if (!title.trim() || !focus.trim()) return Alert.alert('Complete seu treino', 'Informe um nome e um foco muscular.');
    addWorkout({ title: title.trim(), focus: focus.trim(), exerciseCount: Math.max(1, Number(exerciseCount) || 1), duration: duration.trim() || '30 min' });
    setTitle(''); setFocus(''); setExerciseCount('3'); setDuration('45 min'); setShowForm(false);
    Alert.alert('Treino salvo', 'Seu novo treino já está disponível em Meus treinos.');
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View><Text style={styles.kicker}>ORGANIZE SUA ROTINA</Text><Text style={styles.title}>Meus treinos</Text><Text style={styles.subtitle}>Monte sua própria ficha do seu jeito.</Text></View>
    <Pressable style={({ pressed }) => [styles.createButton, pressed && styles.pressed]} onPress={() => setShowForm((value) => !value)}><MaterialIcons name={showForm ? 'close' : 'add'} size={20} color="#17130A" /><Text style={styles.createButtonText}>{showForm ? 'FECHAR' : 'CRIAR MEU TREINO'}</Text></Pressable>
    {showForm ? <View style={styles.formCard}><Text style={styles.formTitle}>Novo treino</Text><Text style={styles.cardLabel}>NOME DO TREINO</Text><TextInput value={title} onChangeText={setTitle} style={styles.textInput} placeholder="Ex.: Treino de pernas" placeholderTextColor="#958A76" /><Text style={styles.cardLabel}>FOCO MUSCULAR</Text><TextInput value={focus} onChangeText={setFocus} style={styles.textInput} placeholder="Ex.: Pernas + Glúteos" placeholderTextColor="#958A76" /><View style={styles.formRow}><View style={{ flex: 1 }}><Text style={styles.cardLabel}>EXERCÍCIOS</Text><TextInput value={exerciseCount} onChangeText={setExerciseCount} keyboardType="number-pad" style={styles.textInput} placeholder="3" placeholderTextColor="#958A76" /></View><View style={{ flex: 1 }}><Text style={styles.cardLabel}>DURAÇÃO</Text><TextInput value={duration} onChangeText={setDuration} style={styles.textInput} placeholder="45 min" placeholderTextColor="#958A76" /></View></View><Text style={styles.helper}>Depois de salvar, você pode abrir a ficha e ajustar cargas, séries e descansos.</Text><Pressable style={styles.saveButton} onPress={saveWorkout}><Text style={styles.saveText}>SALVAR TREINO</Text></Pressable></View> : null}
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Suas fichas</Text><Text style={styles.count}>{customWorkouts.length} criadas</Text></View>
    {customWorkouts.map((workout, index) => <View key={workout.id} style={styles.workoutCard}><View style={styles.workoutTop}><View style={[styles.workoutIcon, { backgroundColor: index === 0 ? '#FFF2A9' : '#FFE4E1' }]}><MaterialIcons name={index === 0 ? 'fitness-center' : 'bolt'} size={22} color={index === 0 ? '#8B7100' : red} /></View><View style={styles.workoutCopy}><Text style={styles.workoutTitle}>{workout.title}</Text><Text style={styles.workoutMeta}>{workout.focus}</Text></View><Pressable onPress={() => Alert.alert('Editar treino', 'A edição detalhada de exercícios estará disponível na próxima etapa.')}><MaterialIcons name="more-vert" size={22} color="#9A8B72" /></Pressable></View><View style={styles.workoutFooter}><Text style={styles.footerItem}>{workout.exerciseCount} exercícios</Text><Text style={styles.footerItem}>{workout.duration}</Text><Pressable style={styles.startSmall} onPress={() => router.push('/workout')}><Text style={styles.startSmallText}>INICIAR</Text><MaterialIcons name="arrow-forward" size={16} color="#17130A" /></Pressable></View></View>)}
    <Text style={styles.sectionTitle}>Exercícios sugeridos</Text>
    {defaultExercises.map((exercise) => <View key={exercise.name} style={styles.exerciseRow}><View style={styles.exerciseIcon}><MaterialIcons name={exercise.icon} size={21} color={red} /></View><View style={styles.exerciseCopy}><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.exerciseDetail}>{exercise.detail}</Text></View><Text style={styles.exerciseLoad}>{exercise.load}</Text></View>)}
    <View style={styles.tip}><MaterialIcons name="lightbulb-outline" size={20} color="#927300" /><Text style={styles.tipText}>Você pode criar uma ficha diferente para cada objetivo: força, hipertrofia, condicionamento ou mobilidade.</Text></View>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34, gap: 15 },
  kicker: { color: '#887C6A', fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: { color: '#17130A', fontSize: 30, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#756B5C', fontSize: 14, lineHeight: 20, marginTop: 5 },
  createButton: { height: 52, borderRadius: 15, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#D7A900' },
  createButtonText: { color: '#17130A', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#EADFB9', gap: 10 },
  formTitle: { color: '#17130A', fontSize: 19, fontWeight: '900', marginBottom: 2 },
  cardLabel: { color: '#887C6A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 3 },
  textInput: { height: 46, borderRadius: 11, backgroundColor: '#FFFDF7', color: '#17130A', paddingHorizontal: 13, fontSize: 14, fontWeight: '700', borderWidth: 1, borderColor: '#E3D7AD' },
  formRow: { flexDirection: 'row', gap: 9 },
  helper: { color: '#8A7D69', fontSize: 11, lineHeight: 17 },
  saveButton: { height: 46, borderRadius: 12, backgroundColor: red, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  saveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  sectionTitle: { color: '#17130A', fontSize: 18, fontWeight: '900' },
  count: { color: red, fontSize: 11, fontWeight: '900' },
  workoutCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#EADFB9', gap: 14 },
  workoutTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  workoutIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  workoutCopy: { flex: 1, gap: 4 },
  workoutTitle: { color: '#17130A', fontSize: 16, fontWeight: '900' },
  workoutMeta: { color: '#8A7D69', fontSize: 12 },
  workoutFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0E8CE', paddingTop: 12, gap: 10 },
  footerItem: { color: '#756B5C', fontSize: 11 },
  startSmall: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF2A9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
  startSmallText: { color: '#5A4800', fontSize: 10, fontWeight: '900' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFFFF', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: '#EADFB9' },
  exerciseIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFE4E1', alignItems: 'center', justifyContent: 'center' },
  exerciseCopy: { flex: 1, gap: 3 },
  exerciseName: { color: '#17130A', fontSize: 13, fontWeight: '800' },
  exerciseDetail: { color: '#8A7D69', fontSize: 11, marginTop: 3 },
  exerciseLoad: { color: '#756B5C', fontSize: 11, fontWeight: '800' },
  tip: { flexDirection: 'row', gap: 10, padding: 15, borderRadius: 15, backgroundColor: '#FFF4C2' },
  tipText: { color: '#66541A', fontSize: 12, lineHeight: 18, flex: 1 },
});

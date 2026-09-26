import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';

const yellow = '#F4C400';
const red = '#D72C2C';
const formatDate = (value: string | Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
const planLabel = (plan: 'premium' | 'plus') => plan === 'plus' ? 'Summer Plus' : 'Summer Premium';
const planPrice = (plan: 'premium' | 'plus') => plan === 'plus' ? 'R$ 8/mês' : 'R$ 5/mês';

export default function AdminStudentsScreen() {
  const { user, loading, isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');
  const studentsQuery = trpc.students.list.useQuery(undefined, { enabled: user?.role === 'admin' });
  const students = studentsQuery.data ?? [];
  const filtered = useMemo(() => students.filter((student) => `${student.name ?? ''} ${student.email ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())), [students, search]);
  const activeCount = students.filter((student) => student.subscription?.status === 'active').length;
  const nextRenewal = students.filter((student) => student.subscription?.status === 'active').sort((a, b) => new Date(a.subscription?.renewalAt ?? 0).getTime() - new Date(b.subscription?.renewalAt ?? 0).getTime())[0]?.subscription?.renewalAt;

  if (loading) return <ScreenContainer edges={['top', 'bottom', 'left', 'right']} containerClassName="bg-background"><View style={styles.center}><ActivityIndicator color={red} /><Text style={styles.muted}>Verificando acesso...</Text></View></ScreenContainer>;
  if (!isAuthenticated || user?.role !== 'admin') return <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-5" containerClassName="bg-background"><View style={styles.center}><MaterialIcons name="lock" size={34} color={red} /><Text style={styles.title}>Área restrita</Text><Text style={styles.muted}>Entre com a conta administradora para acessar os alunos.</Text><Pressable style={styles.primaryButton} onPress={() => router.replace('/admin')}><Text style={styles.primaryText}>IR PARA LOGIN ADMIN</Text></Pressable></View></ScreenContainer>;

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.header}><Pressable style={styles.backButton} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={20} color="#17130A" /></Pressable><View style={{ flex: 1 }}><Text style={styles.kicker}>SUMMER FIT · ADMIN</Text><Text style={styles.title}>Gestão de alunos</Text><Text style={styles.subtitle}>Matrículas, planos ativos e próximas renovações.</Text></View></View><View style={styles.statsRow}><View style={styles.stat}><Text style={styles.statNumber}>{students.length}</Text><Text style={styles.statLabel}>alunos matriculados</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{activeCount}</Text><Text style={styles.statLabel}>com plano ativo</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{nextRenewal ? formatDate(nextRenewal).slice(0, 5) : '—'}</Text><Text style={styles.statLabel}>próxima renovação</Text></View></View><View style={styles.searchBox}><MaterialIcons name="search" size={20} color="#9A8B72" /><TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Buscar por nome ou e-mail" placeholderTextColor="#958A76" /></View>{studentsQuery.isLoading ? <View style={styles.empty}><ActivityIndicator color={red} /><Text style={styles.muted}>Carregando alunos...</Text></View> : filtered.length === 0 ? <View style={styles.empty}><MaterialIcons name="groups" size={36} color="#C6B98F" /><Text style={styles.emptyTitle}>{students.length === 0 ? 'Nenhum aluno matriculado ainda' : 'Nenhum aluno encontrado'}</Text><Text style={styles.muted}>{students.length === 0 ? 'Os alunos aparecerão aqui após fazerem login e concluírem o cadastro.' : 'Tente buscar por outro nome ou e-mail.'}</Text></View> : filtered.map((student) => <View key={student.id} style={styles.studentCard}><View style={styles.studentTop}><View style={styles.avatar}><Text style={styles.avatarText}>{(student.name || 'AL').slice(0, 2).toUpperCase()}</Text></View><View style={styles.studentCopy}><Text style={styles.studentName}>{student.name || 'Aluno sem nome'}</Text><Text style={styles.studentEmail}>{student.email || 'E-mail não informado'}</Text></View><View style={styles.enrolled}><MaterialIcons name="verified" size={14} color="#3B9845" /><Text style={styles.enrolledText}>MATRICULADO</Text></View></View><View style={styles.divider} />{student.subscription?.status === 'active' ? <View style={styles.planRow}><View style={[styles.planIcon, student.subscription.planId === 'plus' && styles.planIconPlus]}><MaterialIcons name={student.subscription.planId === 'plus' ? 'bolt' : 'workspace-premium'} size={20} color={student.subscription.planId === 'plus' ? red : '#927300'} /></View><View style={styles.planCopy}><Text style={styles.planName}>{planLabel(student.subscription.planId)}</Text><Text style={styles.planMeta}>{planPrice(student.subscription.planId)} · ativo desde {formatDate(student.subscription.startedAt)}</Text></View><View style={styles.renewal}><Text style={styles.renewalLabel}>RENOVA EM</Text><Text style={styles.renewalDate}>{formatDate(student.subscription.renewalAt)}</Text></View></View> : <View style={styles.noPlan}><MaterialIcons name="remove-circle-outline" size={20} color="#B29F70" /><View><Text style={styles.noPlanTitle}>Sem plano ativo</Text><Text style={styles.noPlanMeta}>Aguardando aprovação ou adesão</Text></View></View>}</View>)}<Text style={styles.footer}>Lista atualizada em tempo real a partir do cadastro da Summer Fit.</Text></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 35, gap: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FFF4C2', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: red, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#17130A', fontSize: 27, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#756B5C', fontSize: 13, lineHeight: 19, marginTop: 5 },
  statsRow: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: '#EADFB9' },
  statNumber: { color: '#17130A', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#8A7D69', fontSize: 10, lineHeight: 14, marginTop: 3 },
  searchBox: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#EADFB9' },
  searchInput: { flex: 1, color: '#17130A', fontSize: 13 },
  studentCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#EADFB9', gap: 12 },
  studentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 43, height: 43, borderRadius: 14, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#17130A', fontSize: 12, fontWeight: '900' },
  studentCopy: { flex: 1, gap: 3 },
  studentName: { color: '#17130A', fontSize: 14, fontWeight: '900' },
  studentEmail: { color: '#8A7D69', fontSize: 11 },
  enrolled: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  enrolledText: { color: '#3B9845', fontSize: 8, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#F0E8CE' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF2A9', alignItems: 'center', justifyContent: 'center' },
  planIconPlus: { backgroundColor: '#FFE4E1' },
  planCopy: { flex: 1, gap: 3 },
  planName: { color: '#453A24', fontSize: 13, fontWeight: '900' },
  planMeta: { color: '#8A7D69', fontSize: 10 },
  renewal: { alignItems: 'flex-end' },
  renewalLabel: { color: '#887C6A', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  renewalDate: { color: red, fontSize: 13, fontWeight: '900', marginTop: 4 },
  noPlan: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  noPlanTitle: { color: '#756B5C', fontSize: 13, fontWeight: '800' },
  noPlanMeta: { color: '#AA9B83', fontSize: 10, marginTop: 3 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 55, gap: 9, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EADFB9' },
  emptyTitle: { color: '#453A24', fontSize: 15, fontWeight: '900' },
  muted: { color: '#8A7D69', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  primaryButton: { backgroundColor: yellow, borderRadius: 12, height: 46, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#17130A', fontSize: 11, fontWeight: '900' },
  footer: { color: '#A89980', fontSize: 10, textAlign: 'center', marginTop: 4 },
});

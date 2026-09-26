import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { startOAuthLogin } from '@/constants/oauth';
import { trpc } from '@/lib/trpc';

type Status = 'pending' | 'approved' | 'rejected';
const yellow = '#F4C400';
const red = '#D72C2C';

const money = (amountCents: number) => `R$ ${(amountCents / 100).toFixed(2).replace('.', ',')}`;
const formatDate = (value: string | Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));

function AdminLogin() {
  const [isStarting, setIsStarting] = useState(false);
  const handleLogin = async () => { setIsStarting(true); await startOAuthLogin(); setTimeout(() => setIsStarting(false), 1200); };
  return <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-5" containerClassName="bg-background"><View style={styles.center}><Image source={require('@/assets/images/summer-fit-logo.webp')} style={styles.logo} resizeMode="contain" /><View style={styles.lock}><MaterialIcons name="lock" size={25} color="#17130A" /></View><Text style={styles.loginKicker}>ÁREA RESTRITA</Text><Text style={styles.loginTitle}>Painel Summer Fit</Text><Text style={styles.loginText}>Entre com a conta autorizada da academia para gerenciar os pagamentos e liberar os planos dos alunos.</Text><Pressable style={styles.loginButton} onPress={handleLogin} disabled={isStarting}><MaterialIcons name="login" size={20} color="#17130A" /><Text style={styles.loginButtonText}>{isStarting ? 'ABRINDO LOGIN...' : 'ENTRAR COM MINHA CONTA'}</Text></Pressable><Text style={styles.loginHint}>Apenas contas com permissão de administrador conseguem acessar este painel.</Text><Pressable onPress={() => router.back()}><Text style={styles.backLink}>Voltar para o app do aluno</Text></Pressable></View></ScreenContainer>;
}

function Forbidden({ onLogout }: { onLogout: () => void }) {
  return <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-5" containerClassName="bg-background"><View style={styles.center}><View style={[styles.lock, { backgroundColor: '#FFE4E1' }]}><MaterialIcons name="block" size={28} color={red} /></View><Text style={styles.loginKicker}>ACESSO NEGADO</Text><Text style={styles.loginTitle}>Esta área é exclusiva</Text><Text style={styles.loginText}>A conta autenticada não possui permissão de administrador. Entre com a conta proprietária da Summer Fit.</Text><Pressable style={styles.outlineButton} onPress={onLogout}><Text style={styles.outlineText}>SAIR E TROCAR DE CONTA</Text></Pressable><Pressable onPress={() => router.back()}><Text style={styles.backLink}>Voltar para o app</Text></Pressable></View></ScreenContainer>;
}

export default function AdminScreen() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [activeStatus, setActiveStatus] = useState<Status>('pending');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const isAdmin = user?.role === 'admin';
  const requestsQuery = trpc.plans.list.useQuery({ status: activeStatus }, { enabled: isAdmin });
  const reviewMutation = trpc.plans.review.useMutation({ onSuccess: () => { setRejectingId(null); setReason(''); requestsQuery.refetch(); } });
  const requests = requestsQuery.data ?? [];
  const totalValue = useMemo(() => requests.reduce((sum, item) => sum + item.amountCents, 0), [requests]);

  if (loading) return <ScreenContainer edges={['top', 'bottom', 'left', 'right']} containerClassName="bg-background"><View style={styles.center}><ActivityIndicator color={red} size="large" /><Text style={styles.loadingText}>Verificando acesso...</Text></View></ScreenContainer>;
  if (!isAuthenticated) return <AdminLogin />;
  if (!isAdmin) return <Forbidden onLogout={() => logout()} />;

  const review = async (id: number, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !reason.trim()) { setRejectingId(id); return; }
    await reviewMutation.mutateAsync({ id, status, rejectionReason: reason.trim() || undefined });
    Alert.alert(status === 'approved' ? 'Plano aprovado' : 'Solicitação recusada', status === 'approved' ? 'O acesso ao plano foi liberado para o aluno.' : 'A solicitação foi marcada como recusada.');
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.header}><View><Text style={styles.kicker}>SUMMER FIT · ADMIN</Text><Text style={styles.title}>Painel administrativo</Text><Text style={styles.subtitle}>Olá, {user.name || 'administrador'}. Gerencie os planos dos alunos.</Text></View><Pressable style={styles.logoutIcon} onPress={() => logout()}><MaterialIcons name="logout" size={19} color={red} /></Pressable></View><View style={styles.adminBanner}><View style={styles.adminBadge}><MaterialIcons name="verified-user" size={18} color="#17130A" /></View><View style={{ flex: 1 }}><Text style={styles.bannerTitle}>Acesso de administrador</Text><Text style={styles.bannerText}>{user.email || 'Conta Summer Fit'} · unidade Rua Pereira de Araujo, 83</Text></View></View><Pressable style={styles.studentsButton} onPress={() => router.push('/admin-students')}><MaterialIcons name="groups" size={19} color="#17130A" /><Text style={styles.studentsButtonText}>GESTÃO DE ALUNOS</Text><MaterialIcons name="arrow-forward" size={17} color="#17130A" /></Pressable><View style={styles.statsRow}><View style={styles.statCard}><Text style={styles.statNumber}>{requests.length}</Text><Text style={styles.statLabel}>{activeStatus === 'pending' ? 'pendentes' : activeStatus === 'approved' ? 'aprovados' : 'recusados'}</Text></View><View style={styles.statCard}><Text style={styles.statNumber}>{money(totalValue)}</Text><Text style={styles.statLabel}>valor na fila</Text></View></View><View style={styles.tabs}>{(['pending', 'approved', 'rejected'] as Status[]).map((status) => <Pressable key={status} style={[styles.tab, activeStatus === status && styles.tabActive]} onPress={() => { setActiveStatus(status); setRejectingId(null); }}><Text style={[styles.tabText, activeStatus === status && styles.tabTextActive]}>{status === 'pending' ? 'Pendentes' : status === 'approved' ? 'Aprovados' : 'Recusados'}</Text></Pressable>)}</View>{requestsQuery.isLoading ? <View style={styles.empty}><ActivityIndicator color={red} /><Text style={styles.emptyText}>Carregando solicitações...</Text></View> : requests.length === 0 ? <View style={styles.empty}><MaterialIcons name="inbox" size={35} color="#C6B98F" /><Text style={styles.emptyTitle}>Nenhuma solicitação aqui</Text><Text style={styles.emptyText}>Quando um aluno enviar um comprovante, ele aparecerá nesta fila.</Text></View> : requests.map((request) => <View key={request.id} style={styles.requestCard}><View style={styles.requestTop}><View style={styles.avatar}><Text style={styles.avatarText}>{request.studentName.slice(0, 2).toUpperCase()}</Text></View><View style={styles.requestCopy}><Text style={styles.studentName}>{request.studentName}</Text><Text style={styles.studentEmail}>{request.studentEmail || 'E-mail não informado'}</Text></View><View style={[styles.planPill, request.planId === 'plus' && styles.planPillPlus]}><Text style={styles.planPillText}>{request.planId === 'plus' ? 'PLUS · R$ 8' : 'PREMIUM · R$ 5'}</Text></View></View><View style={styles.requestMeta}><Text style={styles.metaText}>Enviado em {formatDate(request.createdAt)}</Text><Text style={styles.metaText}>{money(request.amountCents)}</Text></View>{request.proofUrl ? <Pressable style={styles.proofLink} onPress={() => Alert.alert('Comprovante', request.proofUrl || 'Sem arquivo')}><MaterialIcons name="attach-file" size={17} color={red} /><Text style={styles.proofText}>Ver comprovante</Text></Pressable> : <Text style={styles.noProof}>Comprovante aguardando anexo</Text>}{activeStatus === 'pending' ? <>{rejectingId === request.id ? <View style={styles.rejectBox}><TextInput value={reason} onChangeText={setReason} style={styles.reasonInput} placeholder="Motivo da recusa (obrigatório)" placeholderTextColor="#958A76" autoFocus /><View style={styles.actionRow}><Pressable style={styles.cancelAction} onPress={() => { setRejectingId(null); setReason(''); }}><Text style={styles.cancelText}>CANCELAR</Text></Pressable><Pressable style={styles.rejectAction} onPress={() => review(request.id, 'rejected')}><Text style={styles.rejectText}>CONFIRMAR RECUSA</Text></Pressable></View></View> : <View style={styles.actionRow}><Pressable style={styles.rejectAction} onPress={() => review(request.id, 'rejected')}><MaterialIcons name="close" size={16} color="#FFFFFF" /><Text style={styles.rejectText}>RECUSAR</Text></Pressable><Pressable style={styles.approveAction} onPress={() => review(request.id, 'approved')}><MaterialIcons name="check" size={17} color="#17130A" /><Text style={styles.approveText}>APROVAR E LIBERAR</Text></Pressable></View>}</> : <View style={styles.reviewed}><MaterialIcons name={activeStatus === 'approved' ? 'check-circle' : 'cancel'} size={17} color={activeStatus === 'approved' ? '#3B9845' : red} /><Text style={styles.reviewedText}>{activeStatus === 'approved' ? 'Acesso liberado' : `Recusado${request.rejectionReason ? `: ${request.rejectionReason}` : ''}`}</Text></View>}</View>)}<Text style={styles.footer}>Summer Fit Admin · Todas as ações ficam registradas no histórico.</Text></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 35, gap: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  logo: { width: 260, height: 78, backgroundColor: '#FFFFFF', borderRadius: 11, marginBottom: 22 },
  lock: { width: 58, height: 58, borderRadius: 20, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center' },
  loginKicker: { color: red, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  loginTitle: { color: '#17130A', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  loginText: { color: '#756B5C', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 360 },
  loginButton: { backgroundColor: yellow, borderRadius: 14, height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', maxWidth: 380 },
  loginButtonText: { color: '#17130A', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  loginHint: { color: '#9A8B72', fontSize: 11, textAlign: 'center', maxWidth: 320 },
  backLink: { color: red, fontSize: 12, fontWeight: '900' },
  loadingText: { color: '#756B5C', fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  kicker: { color: red, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#17130A', fontSize: 27, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#756B5C', fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 350 },
  logoutIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF0EE', alignItems: 'center', justifyContent: 'center' },
  adminBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, backgroundColor: '#17130A', borderRadius: 17 },
  adminBadge: { width: 37, height: 37, borderRadius: 12, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  bannerText: { color: '#F8DFA0', fontSize: 11, marginTop: 4 },
  studentsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 45, borderRadius: 12, backgroundColor: yellow },
  studentsButtonText: { color: '#17130A', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, flex: 1 },
  statsRow: { flexDirection: 'row', gap: 11 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#EADFB9' },
  statNumber: { color: '#17130A', fontSize: 23, fontWeight: '900' },
  statLabel: { color: '#8A7D69', fontSize: 11, marginTop: 3 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF0EE', borderRadius: 13, padding: 4, borderWidth: 1, borderColor: '#F0C5BF' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  tabActive: { backgroundColor: yellow },
  tabText: { color: '#8A6F68', fontSize: 10, fontWeight: '900' },
  tabTextActive: { color: '#17130A' },
  requestCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EADFB9', gap: 12 },
  requestTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF2A9', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#6D5700', fontSize: 12, fontWeight: '900' },
  requestCopy: { flex: 1, gap: 3 },
  studentName: { color: '#17130A', fontSize: 14, fontWeight: '900' },
  studentEmail: { color: '#8A7D69', fontSize: 11 },
  planPill: { backgroundColor: '#FFF2A9', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  planPillPlus: { backgroundColor: '#FFE4E1' },
  planPillText: { color: '#66541A', fontSize: 9, fontWeight: '900' },
  requestMeta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0E8CE', paddingTop: 11 },
  metaText: { color: '#8A7D69', fontSize: 11 },
  proofLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proofText: { color: red, fontSize: 11, fontWeight: '900' },
  noProof: { color: '#B29F70', fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  rejectAction: { flex: 1, height: 42, borderRadius: 10, backgroundColor: red, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  rejectText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  approveAction: { flex: 1.4, height: 42, borderRadius: 10, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  approveText: { color: '#17130A', fontSize: 10, fontWeight: '900' },
  cancelAction: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#EADFB9', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#756B5C', fontSize: 10, fontWeight: '900' },
  rejectBox: { gap: 9 },
  reasonInput: { height: 44, borderRadius: 10, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#F0C5BF', color: '#17130A', paddingHorizontal: 12, fontSize: 12 },
  reviewed: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reviewedText: { color: '#756B5C', fontSize: 11, flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 55, gap: 9, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EADFB9' },
  emptyTitle: { color: '#453A24', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#8A7D69', fontSize: 12, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  outlineButton: { height: 48, borderWidth: 1, borderColor: red, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: red, fontSize: 11, fontWeight: '900' },
  footer: { color: '#A89980', fontSize: 10, textAlign: 'center', marginTop: 5 },
});

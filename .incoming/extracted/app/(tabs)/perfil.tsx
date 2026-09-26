import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useAppState } from '@/lib/app-state';

const yellow = '#F4C400';
const red = '#D72C2C';

export default function ProfileScreen() {
  const { studentName, enrollment, pendingPlan } = useAppState();
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <Image source={require('@/assets/images/summer-fit-logo.webp')} style={styles.logo} resizeMode="contain" /><View><Text style={styles.kicker}>SUA CONTA</Text><Text style={styles.title}>Perfil</Text></View>
    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>JS</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{studentName}</Text><Text style={styles.email}>joao@email.com</Text></View><View style={styles.rolePill}><Text style={styles.roleText}>ALUNO</Text></View></View>
    <View style={styles.enrollment}><View><Text style={styles.enrollmentLabel}>MATRÍCULA</Text><Text style={styles.enrollmentCode}>{enrollment}</Text></View></View>
    <View style={styles.address}><MaterialIcons name="location-on" size={22} color={red} /><View><Text style={styles.addressLabel}>SUMMER FIT</Text><Text style={styles.addressText}>Rua Pereira de Araujo, 83</Text><Text style={styles.addressHint}>Sua unidade de treino</Text></View></View>
    <Text style={styles.sectionTitle}>Minha assinatura</Text><View style={styles.subscription}><MaterialIcons name="workspace-premium" size={22} color={yellow} /><View style={{ flex: 1 }}><Text style={styles.subscriptionTitle}>{pendingPlan === 'plus' ? 'Summer Plus' : pendingPlan === 'premium' ? 'Summer Premium' : 'Plano gratuito'}</Text><Text style={styles.subscriptionMeta}>{pendingPlan ? 'Pagamento enviado para análise' : 'Ative recursos para evoluir mais'}</Text></View><Text style={styles.subscriptionStatus}>{pendingPlan ? 'PENDENTE' : 'ATIVAR'}</Text></View>
    <Text style={styles.sectionTitle}>Preferências</Text><View style={styles.menuCard}>{[['notifications-none', 'Notificações', 'Receba lembretes de treino'], ['dark-mode', 'Aparência', 'Tema claro Summer Fit'], ['help-outline', 'Ajuda e suporte', 'Fale com a Summer Fit']].map(([icon, label, detail]) => <Pressable key={label} style={styles.menuItem} onPress={() => Alert.alert(label, detail)}><View style={styles.menuIcon}><MaterialIcons name={icon as any} size={20} color={red} /></View><View style={{ flex: 1 }}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuDetail}>{detail}</Text></View><MaterialIcons name="chevron-right" size={20} color="#9A8B72" /></Pressable>)}</View>
    <Pressable style={styles.adminLink} onPress={() => router.push('/admin')}><MaterialIcons name="admin-panel-settings" size={19} color={red} /><Text style={styles.logoutText}>Acessar painel administrativo</Text></Pressable><Pressable style={styles.logoutButton} onPress={() => router.push('/login')}><MaterialIcons name="logout" size={19} color={red} /><Text style={styles.logoutText}>Sair / entrar com outra conta</Text></Pressable><Text style={styles.version}>Summer Fit v1.1 · Rua Pereira de Araujo, 83</Text>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 15, paddingBottom: 34, gap: 16 },
  logo: { width: 190, height: 55, backgroundColor: '#FFFFFF', borderRadius: 9, alignSelf: 'center' },
  kicker: { color: '#887C6A', fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: { color: '#17130A', fontSize: 30, fontWeight: '900', marginTop: 5 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EADFB9' },
  avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#17130A', fontSize: 17, fontWeight: '900' },
  name: { color: '#17130A', fontSize: 16, fontWeight: '900' },
  email: { color: '#8A7D69', fontSize: 12, marginTop: 4 },
  rolePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#FFF2A9' },
  roleText: { color: '#715900', fontSize: 9, fontWeight: '900' },
  enrollment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF4C2', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#F0D76E' },
  enrollmentLabel: { color: '#856900', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  enrollmentCode: { color: '#17130A', fontSize: 28, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  address: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFF0EE', borderRadius: 17, padding: 16, borderWidth: 1, borderColor: '#F0C5BF' },
  addressLabel: { color: red, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  addressText: { color: '#321110', fontSize: 15, fontWeight: '900', marginTop: 4 },
  addressHint: { color: '#956B65', fontSize: 11, marginTop: 3 },
  sectionTitle: { color: '#17130A', fontSize: 16, fontWeight: '900', marginTop: 2 },
  subscription: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#17130A', borderRadius: 17, padding: 16 },
  subscriptionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  subscriptionMeta: { color: '#F8DFA0', fontSize: 11, marginTop: 3 },
  subscriptionStatus: { color: yellow, fontSize: 9, fontWeight: '900' },
  menuCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 15, borderWidth: 1, borderColor: '#EADFB9' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0E8CE' },
  menuIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF0EE', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: '#453A24', fontSize: 13, fontWeight: '800' },
  menuDetail: { color: '#8A7D69', fontSize: 11, marginTop: 3 },
  logoutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 13 },
  adminLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 5, paddingBottom: 2 },
  logoutText: { color: red, fontSize: 12, fontWeight: '800' },
  version: { color: '#AA9B83', fontSize: 10, textAlign: 'center' },
});

import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useAppState } from '@/lib/app-state';
import { estimateBmr } from '@/lib/fitness';
import { PIX_KEY, PLANS, type PlanId } from '@/lib/plan-config';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';

const yellow = '#F4C400';
const red = '#D72C2C';

export default function PremiumScreen() {
  const { premiumPending, pendingPlan, sendPaymentProof } = useAppState();
  const { user, isAuthenticated } = useAuth();
  const createRequest = trpc.plans.createRequest.useMutation();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('plus');
  const [weight, setWeight] = useState('78');
  const [height, setHeight] = useState('178');
  const [age, setAge] = useState('28');
  const [calories, setCalories] = useState<number | null>(null);
  const selected = PLANS[selectedPlan];

  const calculate = () => {
    const w = Number(weight); const h = Number(height); const a = Number(age);
    if (!w || !h || !a) return Alert.alert('Preencha os dados', 'Informe peso, altura e idade para estimar suas calorias.');
    setCalories(estimateBmr(w, h, a));
  };
  const copyPix = async () => {
    if (Platform.OS === 'web' && navigator.clipboard) await navigator.clipboard.writeText(PIX_KEY);
    Alert.alert('Chave PIX copiada', 'Cole no aplicativo do seu banco para realizar o pagamento.');
  };
  const submitPayment = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login necessário', 'Entre com sua conta para que a Summer Fit consiga vincular o pagamento ao seu cadastro.', [{ text: 'Agora não', style: 'cancel' }, { text: 'Entrar', onPress: () => router.push('/login') }]);
      sendPaymentProof(selectedPlan);
      return;
    }
    await createRequest.mutateAsync({ planId: selectedPlan, amountCents: selected.price * 100, studentName: user?.name || 'Aluno Summer Fit' });
    sendPaymentProof(selectedPlan);
    Alert.alert('Pagamento enviado', `Seu pedido do ${selected.name} está aguardando aprovação da academia.`);
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View><Text style={styles.kicker}>ESCOLHA SUA EXPERIÊNCIA</Text><Text style={styles.title}>Planos Summer Fit</Text><Text style={styles.subtitle}>Mais ferramentas para treinar com constância e energia.</Text></View>
    <View style={styles.planSwitch}><Pressable style={[styles.planTab, selectedPlan === 'premium' && styles.planTabActive]} onPress={() => setSelectedPlan('premium')}><Text style={[styles.planTabText, selectedPlan === 'premium' && styles.planTabTextActive]}>R$ 5 Premium</Text></Pressable><Pressable style={[styles.planTab, selectedPlan === 'plus' && styles.planTabActive]} onPress={() => setSelectedPlan('plus')}><Text style={[styles.planTabText, selectedPlan === 'plus' && styles.planTabTextActive]}>R$ 8 Plus</Text></Pressable></View>
    <View style={[styles.planHero, selectedPlan === 'plus' && styles.planHeroPlus]}><View style={styles.planIcon}><MaterialIcons name={selectedPlan === 'plus' ? 'bolt' : 'workspace-premium'} size={26} color="#17130A" /></View><View style={{ flex: 1 }}><Text style={styles.planName}>{selected.name}</Text><Text style={styles.planPrice}>R$ {selected.price.toFixed(2).replace('.', ',')} <Text style={styles.perMonth}>/ mês</Text></Text></View><Text style={styles.planBadge}>{selected.badge}</Text></View>
    <View style={styles.featuresCard}>{selected.features.map((feature, index) => <View key={feature} style={styles.feature}><MaterialIcons name={index === 0 && selectedPlan === 'plus' ? 'auto-awesome' : 'check-circle'} size={19} color={index === 0 && selectedPlan === 'plus' ? red : '#3B9845'} /><Text style={styles.featureText}>{feature}</Text></View>)}{selectedPlan === 'plus' ? <Text style={styles.plusNote}>O Plus é ideal para quem quer montar várias fichas e acompanhar objetivos diferentes.</Text> : null}</View>
    <View style={styles.paymentCard}><View style={styles.cardHeader}><Text style={styles.cardTitle}>Ativar {selected.name}</Text><Text style={styles.price}>{selected.price.toFixed(2).replace('.', ',')} / mês</Text></View><Text style={styles.cardDescription}>Pagamento manual por PIX. Depois, envie o comprovante para aprovação.</Text><Text style={styles.pixLabel}>CHAVE PIX DA ACADEMIA</Text><View style={styles.pixRow}><Text style={styles.pixText} numberOfLines={1}>{PIX_KEY}</Text><Pressable style={styles.copyButton} onPress={copyPix}><MaterialIcons name="content-copy" size={17} color="#17130A" /></Pressable></View><Pressable style={({ pressed }) => [styles.paymentButton, pressed && styles.pressed]} onPress={submitPayment} disabled={createRequest.isPending}><Text style={styles.paymentButtonText}>{createRequest.isPending ? 'ENVIANDO...' : premiumPending && pendingPlan === selectedPlan ? 'COMPROVANTE ENVIADO' : 'JÁ REALIZEI O PAGAMENTO'}</Text></Pressable><Text style={styles.fileHint}>Você poderá anexar JPG, PNG ou PDF no próximo passo.</Text></View>
    <View style={styles.calorieCard}><View style={styles.cardHeader}><Text style={styles.cardTitle}>Estimativa de calorias</Text><MaterialIcons name="local-fire-department" size={21} color={red} /></View><Text style={styles.cardDescription}>Ferramenta disponível nos planos pagos para uma referência rápida da sua rotina.</Text><View style={styles.inputs}><TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" style={styles.input} placeholder="Peso" placeholderTextColor="#958A76" /><TextInput value={height} onChangeText={setHeight} keyboardType="number-pad" style={styles.input} placeholder="Altura" placeholderTextColor="#958A76" /><TextInput value={age} onChangeText={setAge} keyboardType="number-pad" style={styles.input} placeholder="Idade" placeholderTextColor="#958A76" /></View><Pressable style={styles.outlineButton} onPress={calculate}><Text style={styles.outlineText}>CALCULAR</Text></Pressable>{calories ? <View style={styles.result}><Text style={styles.resultLabel}>METABOLISMO BASAL ESTIMADO</Text><Text style={styles.resultValue}>{calories} kcal/dia</Text></View> : null}<Text style={styles.disclaimer}>Estimativas não substituem acompanhamento de nutricionista ou profissional de saúde.</Text></View>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34, gap: 15 },
  kicker: { color: '#887C6A', fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: { color: '#17130A', fontSize: 29, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#756B5C', fontSize: 14, lineHeight: 20, marginTop: 5 },
  planSwitch: { flexDirection: 'row', padding: 4, backgroundColor: '#FFF0EE', borderRadius: 14, borderWidth: 1, borderColor: '#F0C5BF' },
  planTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  planTabActive: { backgroundColor: yellow },
  planTabText: { color: '#8A6F68', fontSize: 11, fontWeight: '900' },
  planTabTextActive: { color: '#17130A' },
  planHero: { borderRadius: 20, backgroundColor: '#FFF4C2', borderWidth: 1, borderColor: '#F0D76E', padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planHeroPlus: { backgroundColor: '#FFE4E1', borderColor: '#F0C5BF' },
  planIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center' },
  planName: { color: '#17130A', fontSize: 15, fontWeight: '900' },
  planPrice: { color: red, fontSize: 22, fontWeight: '900', marginTop: 4 },
  perMonth: { color: '#8B6D68', fontSize: 12, fontWeight: '700' },
  planBadge: { color: red, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, alignSelf: 'flex-start' },
  featuresCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: '#EADFB9' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0E8CE' },
  featureText: { color: '#453A24', fontSize: 13, flex: 1, fontWeight: '700' },
  plusNote: { color: '#956B65', fontSize: 11, lineHeight: 17, paddingVertical: 13 },
  paymentCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#EADFB9', gap: 11 },
  calorieCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#EADFB9', gap: 11 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#17130A', fontSize: 16, fontWeight: '900' },
  price: { color: red, fontSize: 14, fontWeight: '900' },
  cardDescription: { color: '#8A7D69', fontSize: 12, lineHeight: 18 },
  pixLabel: { color: '#887C6A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 3 },
  pixRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFDF7', borderRadius: 11, borderWidth: 1, borderColor: '#E3D7AD', paddingLeft: 12, overflow: 'hidden' },
  pixText: { color: '#756B5C', flex: 1, fontSize: 11 },
  copyButton: { backgroundColor: yellow, width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  paymentButton: { height: 48, borderRadius: 12, backgroundColor: red, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  paymentButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  fileHint: { color: '#958A76', fontSize: 11, textAlign: 'center' },
  inputs: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 44, borderRadius: 11, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E3D7AD', color: '#17130A', paddingHorizontal: 10, fontSize: 12 },
  outlineButton: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: red, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: red, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  result: { borderRadius: 12, backgroundColor: '#FFF4C2', padding: 13, borderWidth: 1, borderColor: '#F0D76E' },
  resultLabel: { color: '#856900', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  resultValue: { color: '#17130A', fontSize: 22, fontWeight: '900', marginTop: 4 },
  disclaimer: { color: '#958A76', fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});

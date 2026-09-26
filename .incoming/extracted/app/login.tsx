import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';

const yellow = '#F4C400';
const red = '#D72C2C';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = () => {
    if (!email || password.length < 6) return Alert.alert('Confira seus dados', 'Informe um e-mail e uma senha com pelo menos 6 caracteres.');
    router.replace('/(tabs)');
  };

  return <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-5" containerClassName="bg-background"><KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.brandBlock}><Image source={require('@/assets/images/summer-fit-logo.webp')} style={styles.logo} resizeMode="contain" /><View style={styles.redLine} /><Text style={styles.welcome}>A academia que vai esquentar o seu dia!</Text></View>
    <View style={styles.form}><Text style={styles.title}>Entrar no app</Text><Text style={styles.subtitle}>Acesse seus treinos, metas e evolução.</Text><Text style={styles.label}>E-MAIL</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder="voce@email.com" placeholderTextColor="#958A76" /><Text style={styles.label}>SENHA</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="••••••••" placeholderTextColor="#958A76" /><Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={submit}><Text style={styles.primaryText}>ENTRAR</Text><MaterialIcons name="arrow-forward" size={18} color="#17130A" /></Pressable><Pressable onPress={() => Alert.alert('Criar cadastro', 'No cadastro, você poderá informar nome, e-mail e uma matrícula de exatamente 4 números.')}><Text style={styles.signup}>Ainda não tenho conta <Text style={{ color: red, fontWeight: '800' }}>Criar cadastro</Text></Text></Pressable></View><View style={styles.address}><MaterialIcons name="location-on" size={19} color={red} /><View><Text style={styles.addressLabel}>SUMMER FIT</Text><Text style={styles.addressText}>Rua Pereira de Araujo, 83</Text></View></View><Text style={styles.footer}>Treine com energia. Evolua com constância.</Text>
  </KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingTop: 25, paddingBottom: 18 },
  brandBlock: { alignItems: 'center' },
  logo: { width: '100%', height: 105, maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 12 },
  redLine: { height: 5, width: 155, borderRadius: 5, backgroundColor: red, marginTop: 15 },
  welcome: { color: '#6B604E', fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  form: { backgroundColor: '#FFFFFF', padding: 19, borderRadius: 22, borderWidth: 1, borderColor: '#EADFB9', gap: 10, shadowColor: '#8A6D00', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  title: { color: '#17130A', fontSize: 23, fontWeight: '900' },
  subtitle: { color: '#756B5C', fontSize: 13, lineHeight: 18, marginBottom: 5 },
  label: { color: '#857A6A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 4 },
  input: { height: 47, borderRadius: 12, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E3D7AD', color: '#17130A', paddingHorizontal: 13, fontSize: 14 },
  primaryButton: { height: 51, borderRadius: 13, backgroundColor: yellow, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 5 },
  primaryText: { color: '#17130A', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  signup: { color: '#756B5C', textAlign: 'center', fontSize: 12, marginTop: 5 },
  address: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 9, backgroundColor: '#FFF4C2', borderRadius: 13, paddingHorizontal: 15, paddingVertical: 11 },
  addressLabel: { color: '#856900', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  addressText: { color: '#453A24', fontSize: 12, fontWeight: '700', marginTop: 2 },
  footer: { color: '#9B907C', textAlign: 'center', fontSize: 10 },
});

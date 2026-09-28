import Image from 'next/image';
import { ArrowUpRight, MapPin, MessageCircle } from 'lucide-react';
import styles from './nutritionist-card.module.css';

const contactUrl = 'https://www.contate.me/ios/nutrielisabete';
const instagramUrl = 'https://www.instagram.com/elisabetesoares.nutri?stkn=MWJmb3A0b2E5bmJ4dw==';

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NutritionistCard() {
  return (
    <section className={styles.card} aria-labelledby="nutritionist-title">
      <div className={styles.portrait}>
        <Image
          src="/elisabete-soares.jpeg"
          alt="Nutricionista Elisabete Soares"
          width={1536}
          height={1536}
          sizes="(max-width: 600px) 120px, 220px"
        />
      </div>
      <div className={styles.content}>
        <p className={styles.eyebrow}>ACOMPANHAMENTO PROFISSIONAL</p>
        <h2 id="nutritionist-title">Elisabete Soares</h2>
        <p className={styles.role}>Nutricionista</p>
        <p className={styles.description}>
          Quer orientação individual para uma alimentação mais saudável?
          Conheça o trabalho da Elisabete e converse sobre o acompanhamento adequado para você.
        </p>
        <ul className={styles.topics} aria-label="Áreas de atuação informadas no perfil">
          <li>Alimentos funcionais</li>
          <li>Emagrecimento</li>
          <li>Saúde da mulher</li>
          <li>Gestantes</li>
        </ul>
        <p className={styles.location}>
          <MapPin size={17} aria-hidden="true" />
          <span>Consultas online e presenciais no RJ — Rua Pereira de Araújo, ao lado da Sorveteria Ki Delícia.</span>
        </p>
        <div className={styles.actions}>
          <a className={styles.contact} href={contactUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            <MessageCircle size={19} aria-hidden="true" />
            Falar com a Elisabete
            <ArrowUpRight size={18} aria-hidden="true" />
            <span className={styles.srOnly}> (abre em nova aba)</span>
          </a>
          <a className={styles.instagram} href={instagramUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            <InstagramIcon />
            Ver Instagram
            <ArrowUpRight size={18} aria-hidden="true" />
            <span className={styles.srOnly}> da Elisabete (abre em nova aba)</span>
          </a>
        </div>
        <p className={styles.note}>
          A Nutrição IA não substitui o acompanhamento de uma nutricionista.
          Agendamento, valores e condições são combinados diretamente com a profissional, à parte do Summer PRO.
        </p>
      </div>
    </section>
  );
}

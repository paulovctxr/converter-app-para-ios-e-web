type Point = readonly [number, number];

type Pose = {
  head: readonly [number, number, number];
  torso: readonly [Point, Point];
  arms: readonly (readonly Point[])[];
  legs: readonly (readonly Point[])[];
};

type Equipment =
  | "barbell"
  | "bench"
  | "cable"
  | "dumbbell"
  | "machine"
  | "mat"
  | "pullup"
  | "step";

type Movement = {
  start: Pose;
  finish: Pose;
  equipment: Equipment;
};

const standing: Pose = {
  head: [76, 24, 10],
  torso: [[76, 36], [76, 76]],
  arms: [[[76, 43], [61, 63], [60, 85]], [[76, 43], [91, 63], [92, 85]]],
  legs: [[[76, 76], [62, 99], [58, 121]], [[76, 76], [90, 99], [95, 121]]],
};

const movements: Record<string, Movement> = {
  curl: {
    start: standing,
    finish: { ...standing, arms: [[[76, 43], [60, 62], [66, 45]], [[76, 43], [92, 63], [91, 84]]] },
    equipment: "dumbbell",
  },
  press: {
    start: { ...standing, arms: [[[76, 43], [57, 51], [54, 67]], [[76, 43], [95, 51], [98, 67]]] },
    finish: { ...standing, arms: [[[76, 43], [66, 27], [63, 10]], [[76, 43], [86, 27], [89, 10]]] },
    equipment: "dumbbell",
  },
  lateral: {
    start: standing,
    finish: { ...standing, arms: [[[76, 43], [50, 45], [24, 45]], [[76, 43], [102, 45], [128, 45]]] },
    equipment: "dumbbell",
  },
  squat: {
    start: standing,
    finish: {
      head: [69, 40, 10], torso: [[69, 52], [77, 83]],
      arms: [[[70, 56], [51, 61], [43, 57]], [[70, 56], [89, 61], [97, 57]]],
      legs: [[[77, 83], [52, 92], [43, 118]], [[77, 83], [101, 92], [112, 118]]],
    },
    equipment: "barbell",
  },
  hinge: {
    start: standing,
    finish: {
      head: [45, 48, 10], torso: [[55, 55], [84, 78]],
      arms: [[[58, 58], [64, 77], [69, 94]], [[62, 60], [72, 76], [78, 92]]],
      legs: [[[84, 78], [73, 99], [70, 121]], [[84, 78], [99, 99], [104, 121]]],
    },
    equipment: "barbell",
  },
  row: {
    start: {
      head: [48, 43, 10], torso: [[57, 51], [84, 76]],
      arms: [[[60, 55], [78, 67], [103, 73]], [[64, 58], [82, 70], [107, 76]]],
      legs: [[[84, 76], [70, 99], [65, 121]], [[84, 76], [101, 98], [108, 121]]],
    },
    finish: {
      head: [48, 43, 10], torso: [[57, 51], [84, 76]],
      arms: [[[60, 55], [76, 69], [73, 79]], [[64, 58], [80, 71], [78, 82]]],
      legs: [[[84, 76], [70, 99], [65, 121]], [[84, 76], [101, 98], [108, 121]]],
    },
    equipment: "barbell",
  },
  pulldown: {
    start: { ...standing, arms: [[[76, 43], [55, 25], [42, 10]], [[76, 43], [97, 25], [110, 10]]] },
    finish: { ...standing, arms: [[[76, 43], [55, 48], [50, 64]], [[76, 43], [97, 48], [102, 64]]] },
    equipment: "cable",
  },
  pushdown: {
    start: { ...standing, arms: [[[76, 43], [60, 56], [67, 69]], [[76, 43], [92, 56], [85, 69]]] },
    finish: { ...standing, arms: [[[76, 43], [60, 57], [59, 86]], [[76, 43], [92, 57], [93, 86]]] },
    equipment: "cable",
  },
  benchPress: {
    start: {
      head: [36, 72, 9], torso: [[47, 73], [93, 73]],
      arms: [[[58, 70], [57, 50], [77, 50]], [[65, 70], [66, 54], [84, 50]]],
      legs: [[[93, 73], [111, 89], [108, 116]], [[93, 73], [121, 88], [128, 116]]],
    },
    finish: {
      head: [36, 72, 9], torso: [[47, 73], [93, 73]],
      arms: [[[58, 70], [67, 45], [73, 24]], [[65, 70], [74, 45], [80, 24]]],
      legs: [[[93, 73], [111, 89], [108, 116]], [[93, 73], [121, 88], [128, 116]]],
    },
    equipment: "bench",
  },
  pushup: {
    start: {
      head: [37, 58, 8], torso: [[47, 62], [94, 72]],
      arms: [[[54, 64], [51, 82], [43, 101]], [[60, 66], [57, 84], [49, 102]]],
      legs: [[[94, 72], [113, 84], [130, 102]], [[94, 72], [117, 82], [135, 101]]],
    },
    finish: {
      head: [37, 77, 8], torso: [[47, 81], [94, 86]],
      arms: [[[54, 82], [43, 91], [43, 103]], [[60, 83], [50, 93], [49, 103]]],
      legs: [[[94, 86], [116, 93], [130, 103]], [[94, 86], [119, 91], [135, 102]]],
    },
    equipment: "mat",
  },
  machineLeg: {
    start: {
      head: [54, 36, 9], torso: [[58, 47], [69, 80]],
      arms: [[[60, 52], [45, 68], [43, 83]], [[62, 52], [76, 66], [79, 80]]],
      legs: [[[69, 80], [91, 88], [93, 116]], [[69, 80], [97, 88], [102, 116]]],
    },
    finish: {
      head: [54, 36, 9], torso: [[58, 47], [69, 80]],
      arms: [[[60, 52], [45, 68], [43, 83]], [[62, 52], [76, 66], [79, 80]]],
      legs: [[[69, 80], [93, 82], [124, 83]], [[69, 80], [98, 87], [130, 91]]],
    },
    equipment: "machine",
  },
  lunge: {
    start: standing,
    finish: {
      head: [76, 29, 10], torso: [[76, 41], [76, 80]],
      arms: standing.arms,
      legs: [[[76, 80], [48, 93], [34, 119]], [[76, 80], [99, 98], [118, 118]]],
    },
    equipment: "dumbbell",
  },
  hip: {
    start: {
      head: [39, 58, 9], torso: [[48, 62], [81, 88]],
      arms: [[[53, 66], [66, 76], [77, 82]], [[56, 67], [69, 76], [80, 84]]],
      legs: [[[81, 88], [105, 92], [117, 116]], [[81, 88], [98, 96], [104, 118]]],
    },
    finish: {
      head: [39, 58, 9], torso: [[48, 62], [91, 69]],
      arms: [[[53, 64], [68, 69], [82, 70]], [[56, 66], [71, 72], [85, 71]]],
      legs: [[[91, 69], [109, 86], [117, 116]], [[91, 69], [101, 91], [104, 118]]],
    },
    equipment: "bench",
  },
  pullup: {
    start: { ...standing, arms: [[[76, 43], [59, 26], [46, 10]], [[76, 43], [93, 26], [106, 10]]] },
    finish: {
      head: [76, 34, 10], torso: [[76, 46], [76, 80]],
      arms: [[[76, 48], [57, 35], [46, 10]], [[76, 48], [95, 35], [106, 10]]],
      legs: [[[76, 80], [67, 101], [61, 121]], [[76, 80], [85, 101], [91, 121]]],
    },
    equipment: "pullup",
  },
  core: {
    start: {
      head: [39, 83, 9], torso: [[49, 86], [88, 89]],
      arms: [[[54, 85], [72, 75], [90, 70]], [[56, 88], [73, 81], [91, 78]]],
      legs: [[[88, 89], [108, 99], [125, 106]], [[88, 89], [107, 88], [126, 84]]],
    },
    finish: {
      head: [55, 56, 9], torso: [[62, 65], [88, 89]],
      arms: [[[66, 68], [78, 76], [91, 79]], [[68, 70], [81, 79], [94, 82]]],
      legs: [[[88, 89], [108, 99], [125, 106]], [[88, 89], [107, 88], [126, 84]]],
    },
    equipment: "mat",
  },
  calf: {
    start: standing,
    finish: { ...standing, legs: [[[76, 76], [62, 98], [60, 116]], [[76, 76], [90, 98], [96, 116]]] },
    equipment: "step",
  },
};

const movementBySlug: Record<string, keyof typeof movements> = {
  "supino-reto-barra": "benchPress", "supino-inclinado-halteres": "benchPress", "triceps-testa": "benchPress",
  "crucifixo-maquina": "press", "flexao-bracos": "pushup", "puxada-alta": "pulldown",
  "remada-baixa": "row", "remada-curvada": "row", "barra-fixa": "pullup", "pullover-polia": "pulldown",
  "agachamento-livre": "squat", "leg-press": "machineLeg", "cadeira-extensora": "machineLeg",
  "mesa-flexora": "machineLeg", stiff: "hinge", "levantamento-terra": "hinge", afundo: "lunge",
  "panturrilha-em-pe": "calf", "elevacao-pelvica": "hip", "abducao-maquina": "machineLeg",
  "desenvolvimento-halteres": "press", "elevacao-lateral": "lateral", "face-pull": "pulldown",
  "rosca-direta": "curl", "rosca-alternada": "curl", "rosca-martelo": "curl",
  "triceps-corda": "pushdown", "mergulho-banco": "pushup", prancha: "pushup",
  "abdominal-supra": "core", "dead-bug": "core",
};

function EquipmentDrawing({ type, pose }: { type: Equipment; pose: Pose }) {
  const hands = pose.arms.map((arm) => arm[arm.length - 1]);
  if (type === "bench") return <><path d="M22 82H103" /><path d="M32 82v34M94 82v34" /><path d="M54 45h42" /></>;
  if (type === "cable") return <><path d="M134 10v106M126 10h16" /><path d={`M134 12L${hands[0][0]} ${hands[0][1]}`} className="exercise-cable" /></>;
  if (type === "machine") return <><path d="M36 48v68M36 82h42M78 82v34" /><rect x="116" y="72" width="12" height="34" rx="4" /></>;
  if (type === "pullup") return <path d="M34 10h84M42 10v12M110 10v12" />;
  if (type === "mat") return <path d="M18 106h122" className="exercise-floor" />;
  if (type === "step") return <path d="M42 118h72v8H42z" />;
  if (type === "barbell") return <><path d={`M${hands[0][0] - 18} ${hands[0][1]}H${hands[0][0] + 18}`} /><path d={`M${hands[0][0] - 16} ${hands[0][1] - 5}v10M${hands[0][0] + 16} ${hands[0][1] - 5}v10`} /></>;
  return <>{hands.map(([x, y], index) => <g key={index}><path d={`M${x - 7} ${y}h14`} /><circle cx={x - 8} cy={y} r="3" /><circle cx={x + 8} cy={y} r="3" /></g>)}</>;
}

function PoseDrawing({ pose, equipment }: { pose: Pose; equipment: Equipment }) {
  return (
    <g className="exercise-pose">
      <EquipmentDrawing type={equipment} pose={pose} />
      <circle cx={pose.head[0]} cy={pose.head[1]} r={pose.head[2]} className="exercise-head" />
      <path d={`M${pose.torso[0][0]} ${pose.torso[0][1]}L${pose.torso[1][0]} ${pose.torso[1][1]}`} className="exercise-body" />
      {pose.arms.map((points, index) => <polyline key={`a-${index}`} points={points.map((point) => point.join(",")).join(" ")} className="exercise-limb" />)}
      {pose.legs.map((points, index) => <polyline key={`l-${index}`} points={points.map((point) => point.join(",")).join(" ")} className="exercise-limb" />)}
    </g>
  );
}

export function ExerciseIllustration({ slug, name }: { slug: string; name: string }) {
  const movement = movements[movementBySlug[slug] || "curl"];
  return (
    <figure className="exercise-illustration">
      <div>
        <span>Início</span>
        <svg viewBox="0 0 152 130" role="img" aria-label={`Posição inicial de ${name}`}>
          <PoseDrawing pose={movement.start} equipment={movement.equipment} />
        </svg>
      </div>
      <div>
        <span>Movimento</span>
        <svg viewBox="0 0 152 130" role="img" aria-label={`Movimento de ${name}`}>
          <PoseDrawing pose={movement.finish} equipment={movement.equipment} />
        </svg>
      </div>
      <figcaption>Ilustração orientativa • execute com controle e carga adequada.</figcaption>
    </figure>
  );
}

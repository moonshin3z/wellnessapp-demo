-- V10__demo_data.sql
-- Demo user and realistic sample data for deployment showcase
-- Login: demo@wellness.app / Demo2024!

-- 1. Demo user (BCrypt hash of "Demo2024!")
INSERT INTO users (email, password_hash, role, auth_provider, name, created_at)
VALUES (
  'demo@wellness.app',
  '$2a$10$Wu/sGO5K.IQYky54u004Nu.lqZLghGQIUTjCxgYGQmPjl4MNHnFI.',
  'USER',
  'LOCAL',
  'Demo User',
  NOW() - INTERVAL '35 days'
)
ON CONFLICT (email) DO NOTHING;

-- 2. Mood entries + Assessment results
DO $$
DECLARE
  demo_uid BIGINT;
  i INT;
  mood INT;
  emoji TEXT;
  note TEXT;
  tag TEXT;
  sleep_h DOUBLE PRECISION;
  sleep_q INT;
  entry_date TIMESTAMP;
BEGIN
  SELECT id INTO demo_uid FROM users WHERE email = 'demo@wellness.app';
  IF demo_uid IS NULL THEN
    RAISE NOTICE 'Demo user not found, skipping demo data';
    RETURN;
  END IF;

  -- Clean any existing demo data
  DELETE FROM mood_entries WHERE user_id = demo_uid;
  DELETE FROM assessment_results WHERE user_id = demo_uid;

  -- 30 days of mood entries with a realistic narrative arc
  FOR i IN 0..29 LOOP
    entry_date := (NOW() - (i || ' days')::INTERVAL)::DATE
                  + TIME '08:00:00' + (random() * INTERVAL '10 hours');

    -- Mood pattern: starts moderate, dips mid-month, improves recently
    mood := CASE
      WHEN i < 5  THEN (ARRAY[4,4,5,4,3])[i+1]
      WHEN i < 10 THEN (ARRAY[3,2,3,4,3])[i-4]
      WHEN i < 15 THEN (ARRAY[2,3,2,3,4])[i-9]
      WHEN i < 20 THEN (ARRAY[3,3,4,2,3])[i-14]
      WHEN i < 25 THEN (ARRAY[2,3,3,4,3])[i-19]
      ELSE             (ARRAY[3,2,3,3,4])[i-24]
    END;

    emoji := CASE mood
      WHEN 1 THEN '😢' WHEN 2 THEN '😔' WHEN 3 THEN '😐'
      WHEN 4 THEN '😊' WHEN 5 THEN '😄'
    END;

    note := CASE mood
      WHEN 1 THEN (ARRAY[
        'Día muy difícil, mucho estrés con los exámenes',
        'No dormí bien y me sentí agotado todo el día',
        'Discusión con un amigo, me afectó bastante'
      ])[1 + (i % 3)]
      WHEN 2 THEN (ARRAY[
        'Cansancio acumulado, necesito descansar más',
        'El trabajo fue pesado hoy, me siento abrumado',
        'No tuve energía para hacer ejercicio',
        'Día gris, sin mucha motivación'
      ])[1 + (i % 4)]
      WHEN 3 THEN (ARRAY[
        'Día normal, sin novedades importantes',
        'Rutina habitual, nada especial',
        'Día tranquilo pero sin mucha energía',
        'Avancé un poco en mis pendientes'
      ])[1 + (i % 4)]
      WHEN 4 THEN (ARRAY[
        'Buena sesión de ejercicio por la mañana',
        'Almuerzo agradable con compañeros',
        'Logré terminar un proyecto importante',
        'Paseo por el parque, me relajó mucho'
      ])[1 + (i % 4)]
      WHEN 5 THEN (ARRAY[
        'Día increíble! Me sentí muy productivo',
        'Recibí buenas noticias, estoy muy contento',
        'Excelente día con familia y amigos'
      ])[1 + (i % 3)]
    END;

    tag := CASE mood
      WHEN 1 THEN 'stress,sleep'
      WHEN 2 THEN (ARRAY['stress,tired','overwork,sleep','tired,anxiety'])[1 + (i % 3)]
      WHEN 3 THEN (ARRAY['work,routine','routine','work,tired'])[1 + (i % 3)]
      WHEN 4 THEN (ARRAY['exercise,sleep','social,achievement','nature,hobby'])[1 + (i % 3)]
      WHEN 5 THEN (ARRAY['exercise,social','sleep,hobby','social,nature'])[1 + (i % 3)]
    END;

    -- Sleep correlates with mood
    sleep_h := CASE mood
      WHEN 1 THEN 4.0 + (random() * 2)
      WHEN 2 THEN 5.0 + (random() * 2)
      WHEN 3 THEN 6.0 + (random() * 1.5)
      WHEN 4 THEN 6.5 + (random() * 2)
      WHEN 5 THEN 7.0 + (random() * 1.5)
    END;
    sleep_h := round(sleep_h::numeric * 2) / 2.0;

    sleep_q := CASE mood
      WHEN 1 THEN 1 + (i % 2)
      WHEN 2 THEN 2 + (i % 2)
      WHEN 3 THEN 2 + (i % 2)
      WHEN 4 THEN 3 + (i % 2)
      WHEN 5 THEN 4 + (i % 2)
    END;
    IF sleep_q > 5 THEN sleep_q := 5; END IF;

    INSERT INTO mood_entries (user_id, mood_score, mood_emoji, notes, tags, sleep_hours, sleep_quality, created_at)
    VALUES (demo_uid, mood, emoji, note, tag, sleep_h, sleep_q, entry_date);
  END LOOP;

  -- 3. GAD-7 results (progressive improvement)
  INSERT INTO assessment_results (user_id, assessment_type, total, category, notes, created_at)
  VALUES
    (demo_uid, 'GAD7', 14, 'moderada',
     'Semana de exámenes finales, mucha ansiedad',
     NOW() - INTERVAL '28 days'),
    (demo_uid, 'GAD7', 11, 'moderada',
     'Mejorando un poco pero aún con preocupaciones',
     NOW() - INTERVAL '21 days'),
    (demo_uid, 'GAD7', 7, 'leve',
     'Los ejercicios de respiración están ayudando',
     NOW() - INTERVAL '14 days'),
    (demo_uid, 'GAD7', 5, 'leve',
     'Me siento más tranquilo esta semana',
     NOW() - INTERVAL '5 days');

  -- 4. PHQ-9 results (progressive improvement)
  INSERT INTO assessment_results (user_id, assessment_type, total, category, notes, created_at)
  VALUES
    (demo_uid, 'PHQ9', 12, 'moderada',
     'Dificultad para concentrarme y falta de energía',
     NOW() - INTERVAL '27 days'),
    (demo_uid, 'PHQ9', 9, 'leve',
     'Algo mejor, el ejercicio ha ayudado',
     NOW() - INTERVAL '20 days'),
    (demo_uid, 'PHQ9', 7, 'leve',
     'Dormiendo mejor, más motivación',
     NOW() - INTERVAL '12 days'),
    (demo_uid, 'PHQ9', 4, 'mínima',
     'Gran mejoría, me siento con más energía',
     NOW() - INTERVAL '3 days');

  RAISE NOTICE 'Demo data inserted for user %', demo_uid;
END $$;

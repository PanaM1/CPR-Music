import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useDispatch, useSelector } from 'react-redux';
import dynamic from 'next/dynamic';
import Button from 'react-bootstrap/Button';
import { FaCheck, FaFrownOpen } from 'react-icons/fa';
import Spinner from 'react-bootstrap/Spinner';
import Accordion from 'react-bootstrap/Accordion';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { getStudentAssignments, mutateCreateSubmission } from '../../../api';
import Recorder from '../../recorder';
import {
  postRecording,
} from '../../../actions';
import { UploadStatusEnum } from '../../../types';
import { Col, Row } from 'react-bootstrap';

const FlatEditor = dynamic(() => import('../../flatEditor'), {
  ssr: false,
});

const ExploratoryCompose = dynamic(() => import('../../exploratoryCompose'), {
  ssr: false,
})

const MergingScore = dynamic(() => import('../../mergingScore'), {
  ssr: false,
});

const ChordScaleBucketScore = dynamic(
  () => import('../../chordScaleBucketScore'),
  {
    ssr: false,
  }
);

const MEASURES_PER_STEP = 4;

const bucketColors = {
  tonic: '#E75B5C',
  subdominant: '#265C5C',
  dominant: '#4390E2',
};

export default function CreativityActivity() {
  const dispatch = useDispatch();
  // I think this should show the melody for the current piece, but in the student's transposition
  // need to get the student's current assignment
  const router = useRouter();
  const { slug, piece } = router.query;
  const actCategory = 'Create';
  const [melodyJson, setMelodyJson] = useState('');

  // let's just store the calculated 4 measure slices of
  // the score and the corresponding colors
  const [subScores, setSubScores] = useState([]);
  const [subColors, setSubColors] = useState([]);
  // const [scoreData, setScoreData] = useState([]);
  const scoreDataRef = useRef([]);
  // const [totalScoreJSON, setTotalScoreJSON] = useState('');
  const totalScoreJSON = useRef('');
  const [isDoneComposing, setIsDoneComposing] = useState(false);

  // const userInfo = useSelector((state) => state.currentUser);

  const {
    isLoading: loaded,
    error: assignmentsError,
    data: assignments,
  } = useQuery('assignments', getStudentAssignments(slug), {
    enabled: !!slug,
  });

  //only when melodyJson is updated, calculate the steps
  useEffect(() => {
    if (melodyJson && melodyJson.length > 0) {
      const referenceScoreObj = JSON.parse(melodyJson);
      let partialScores = [];
      let partialColors = [];

      scoreDataRef.current = [];
      const measureCount = referenceScoreObj['score-partwise'].part[0].measure.length;
      for (let i = 0; i < measureCount; i += MEASURES_PER_STEP) {
        const slice = JSON.parse(melodyJson);
        slice['score-partwise'].part[0].measure = slice['score-partwise'].part[0].measure.slice(i, i + MEASURES_PER_STEP);
        slice['score-partwise'].part[0].measure[0].attributes[0].clef = referenceScoreObj['score-partwise'].part[0].measure[0].attributes[0].clef;
        slice['score-partwise'].part[0].measure[0].attributes[0].key = referenceScoreObj['score-partwise'].part[0].measure[0].attributes[0].key;
        
        slice['score-partwise'].part[0].measure[0].attributes[0].divisions = referenceScoreObj['score-partwise'].part[0].measure[0].attributes[0].divisions
        slice['score-partwise'].part[0].measure[0].attributes[0].time = referenceScoreObj['score-partwise'].part[0].measure[0].attributes[0].time
        slice['score-partwise'].part[0].measure[0].attributes[0]['staff-details'] = referenceScoreObj['score-partwise'].part[0].measure[0].attributes[0]['staff-details']
        
        partialScores.push(JSON.stringify(slice));

        const colorSlice = currentAssignment?.part?.chord_scale_pattern?.slice(i, i+MEASURES_PER_STEP)
        partialColors.push(colorSlice);
        scoreDataRef.current.push({});
      }
      setSubScores(partialScores);
      setSubColors(partialColors);
    }

  }, [melodyJson]);

  const mutation = useMutation(mutateCreateSubmission({ slug }));

  const currentAssignment =
    assignments &&
    Object.values(assignments)
      .reduce((prev, current) => [...prev, ...current], [])
      .filter((assn) => {
        return (
          assn.piece_slug === piece &&
          assn.activity_type_category === actCategory
        );
      })?.[0];
  const currentTransposition = currentAssignment?.transposition;
  const flatIOScoreForTransposition =
    currentAssignment?.part?.transpositions?.filter(
      (partTransposition) =>
        partTransposition.transposition.name === currentTransposition
    )?.[0]?.flatio;
  const submitCreativity = ({ audio, submissionId }) =>dispatch(
      postRecording({
        slug,
        assignmentId: currentAssignment.id,
        audio,
        composition: totalScoreJSON.current,
        submissionId,
      })
    );
  let scoreJSON;
  if (flatIOScoreForTransposition) {
    scoreJSON = JSON.parse(flatIOScoreForTransposition);
  }

  function onMerged (mergedData) {
    totalScoreJSON.current = mergedData;
  }

  function handleSubmit(i) {
    return (data) => {
      scoreDataRef.current[i] = data;
    }
  }

  return flatIOScoreForTransposition ? (
    <>
      <FlatEditor score={scoreJSON} giveJSON={setMelodyJson} debugMsg='error in rendering the melody score in create: theoretical'/>
      <Row>
        <Col md={4}>
          <ChordScaleBucketScore
            height={150}
            referenceScoreJSON={melodyJson}
            chordScaleBucket="tonic"
            colors='tonic'
            instrumentName={currentAssignment?.instrument}
          />
          <ChordScaleBucketScore
            height={150}
            referenceScoreJSON={melodyJson}
            chordScaleBucket="subdominant"
            colors='subdominant'
            instrumentName={currentAssignment?.instrument}
          />
          <ChordScaleBucketScore
            height={150}
            referenceScoreJSON={melodyJson}
            chordScaleBucket="dominant"
            colors='dominant'
            instrumentName={currentAssignment?.instrument}
          />
        </Col>
        <Col md>
          {
            subScores && subScores.map((subScore, idx) => {
              return (
                <div key={idx}>
                  <h2 id={`step-${idx + 1}`}>Step {idx + 1}</h2>
                  <ExploratoryCompose 
                    referenceScoreJSON={subScore}
                    colors={subColors[idx]}
                    onUpdate={handleSubmit(idx)}
                  /> 
                </div>
              );
            })
          }
          <Button onClick={()=>{console.log('clicked done', isDoneComposing); setIsDoneComposing(true)}}>Done Composing</Button>
          <h2>Step {subScores.length + 1} - Combined</h2>
          {scoreDataRef.current && scoreDataRef.current.length > 0 && isDoneComposing && <MergingScore giveJSON={onMerged} scores={scoreDataRef} />}
        </Col>
      </Row>

      <Recorder
        submit={submitCreativity}
        accompaniment={currentAssignment?.part?.piece?.accompaniment}
      />
    </>
  ) : (
    <Spinner
      as="span"
      animation="border"
      size="sm"
      role="status"
      aria-hidden="true"
    >
      <span className="visually-hidden">Loading...</span>
    </Spinner>
  );

  // return <p>Creativity</p>
}

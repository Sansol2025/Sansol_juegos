
// src/components/features/trivia-game.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Lightbulb, RotateCcw, Award, HelpCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TriviaQuestionOption {
  originalId: 'a' | 'b' | 'c';
  text: string;
}
interface TriviaQuestion {
  id: string;
  questionText: string;
  options: TriviaQuestionOption[];
  correctOriginalId: 'a' | 'b' | 'c';
}

interface DisplayedOption {
  displayId: 'a' | 'b' | 'c';
  text: string;
  isCorrect: boolean;
}

const SANSOL_TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 'q1',
    questionText: '¿Cuántos años cumplimos en Junio de 2025?',
    options: [
      { originalId: 'a', text: '1 año' },
      { originalId: 'b', text: '3 años' },
      { originalId: 'c', text: '5 años' },
    ],
    correctOriginalId: 'a',
  },
  {
    id: 'q2',
    questionText: '¿En qué avenida está nuestro local?',
    options: [
      { originalId: 'a', text: 'Av. Angelelli' },
      { originalId: 'b', text: 'Av. San Nicolás de Bari' },
      { originalId: 'c', text: 'Av. Facundo Quiroga' },
    ],
    correctOriginalId: 'a',
  },
  {
    id: 'q3',
    questionText: '¿Qué productos principales vendemos?',
    options: [
      { originalId: 'a', text: 'Chocolates y Golosinas' },
      { originalId: 'b', text: 'Bebidas y Snacks' },
      { originalId: 'c', text: 'Parlantes y Electrónica' },
    ],
    correctOriginalId: 'c',
  },
];

const QUESTIONS_TO_WIN = 2;
const TOTAL_QUESTIONS_TO_PLAY = 3;

type GameState = "idle" | "playing" | "answered" | "gameOver" | "gameWon";

interface TriviaGameProps {
  onGameWonSuccessfully: () => void;
}

export default function TriviaGame({ onGameWonSuccessfully }: TriviaGameProps) {
  const [questionsForCurrentGame, setQuestionsForCurrentGame] = useState<TriviaQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [displayedOptions, setDisplayedOptions] = useState<DisplayedOption[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<'a' | 'b' | 'c' | null>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect_final' | 'incorrect_retry'; message: string; correctAnswerText?: string } | null>(null);
  const [hasUsedSecondChanceThisQuestion, setHasUsedSecondChanceThisQuestion] = useState(false);
  const { toast } = useToast();

  const currentQuestion = questionsForCurrentGame[currentQuestionIndex];

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffledArray = [...array];
    for (let i = shuffledArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    return shuffledArray;
  };

  const prepareNewGame = useCallback(() => {
    const shuffledGameQuestions = shuffleArray([...SANSOL_TRIVIA_QUESTIONS]).slice(0, TOTAL_QUESTIONS_TO_PLAY);
    setQuestionsForCurrentGame(shuffledGameQuestions);
    setCurrentQuestionIndex(0);
    setSelectedDisplayId(null);
    setScore(0);
    setFeedback(null);
    setHasUsedSecondChanceThisQuestion(false);
    setGameState("playing");
  }, []);
  
  useEffect(() => {
    if (gameState === "idle") {
      prepareNewGame();
    }
  }, [gameState, prepareNewGame]);

  useEffect(() => {
    if (currentQuestion) {
      const { options, correctOriginalId } = currentQuestion;
      const optionsToShuffle = options.map(opt => ({
        text: opt.text,
        isCorrectOriginal: opt.originalId === correctOriginalId,
      }));
      const shuffled = shuffleArray(optionsToShuffle);
      const newDisplayedOptions: DisplayedOption[] = shuffled.map((opt, index) => ({
        displayId: ['a', 'b', 'c'][index] as 'a' | 'b' | 'c',
        text: opt.text,
        isCorrect: opt.isCorrectOriginal,
      }));
      setDisplayedOptions(newDisplayedOptions);
      setSelectedDisplayId(null); // Reset selection for new question
      setHasUsedSecondChanceThisQuestion(false); // Reset second chance for new question
    }
  }, [currentQuestion]);

  const handleOptionChange = (value: string) => {
    setSelectedDisplayId(value as 'a' | 'b' | 'c');
  };

  const handleSubmitAnswer = () => {
    if (!selectedDisplayId || !displayedOptions.length) return;

    const chosenOption = displayedOptions.find(opt => opt.displayId === selectedDisplayId);
    if (!chosenOption) return;

    const isAnswerCorrect = chosenOption.isCorrect;
    
    if (isAnswerCorrect) {
      setScore(prevScore => prevScore + 1);
      setFeedback({ type: 'correct', message: '¡Respuesta Correcta!' });
      toast({ title: "¡Correcto!", className: "bg-green-600 text-white border-green-600" });
      setGameState("answered");
    } else { // Incorrect answer
      if (!hasUsedSecondChanceThisQuestion) {
        setHasUsedSecondChanceThisQuestion(true);
        setFeedback({ type: 'incorrect_retry', message: 'Respuesta incorrecta. ¡Tienes un intento más para esta pregunta!' });
        toast({ 
            title: "Intento Fallido", 
            description: "¡Ups! Esa no era. Pero tienes otra oportunidad para esta pregunta.", 
            variant: "default",
            className: "bg-yellow-100 border-yellow-400 text-yellow-700"
        });
        setSelectedDisplayId(null); // User must re-select
        // GameState remains "playing"
      } else {
        const correctAnswerText = displayedOptions.find(opt => opt.isCorrect)?.text || "";
        setFeedback({ type: 'incorrect_final', message: `Incorrecto. La respuesta correcta era: ${correctAnswerText}`, correctAnswerText });
        toast({ variant: "destructive", title: "Incorrecto de Nuevo", description: `La respuesta correcta era: ${correctAnswerText}` });
        setGameState("answered");
      }
    }
  };

  const handleNextAction = () => {
    setFeedback(null);
    
    if (currentQuestionIndex + 1 < TOTAL_QUESTIONS_TO_PLAY) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      // setSelectedDisplayId(null); // This is handled by useEffect [currentQuestion]
      // setHasUsedSecondChanceThisQuestion(false); // This is also handled by useEffect [currentQuestion]
      setGameState("playing");
    } else {
      if (score >= QUESTIONS_TO_WIN) {
        setGameState("gameWon");
        onGameWonSuccessfully();
      } else {
        setGameState("gameOver");
        toast({ variant: "destructive", title: "Juego Terminado", description: `No alcanzaste las ${QUESTIONS_TO_WIN} respuestas correctas. ¡Inténtalo de nuevo!` });
      }
    }
  };

  if (gameState === "idle" || !currentQuestion) {
    return (
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary flex items-center justify-center gap-2"><HelpCircle className="h-8 w-8"/>Trivia Sansol</CardTitle>
          <CardDescription>Pon a prueba tus conocimientos sobre Sansol y gana.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={prepareNewGame} className="bg-primary hover:bg-primary/90 text-lg py-6">
            <Lightbulb className="mr-2" /> Comenzar Trivia
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (gameState === "gameWon") {
    return (
      <Card className="w-full max-w-lg shadow-xl text-center">
        <CardHeader>
          <Award className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <CardTitle className="text-3xl font-headline text-primary">¡Trivia Superada!</CardTitle>
          <CardDescription>Has respondido {score} de {TOTAL_QUESTIONS_TO_PLAY} preguntas correctamente. ¡Ya puedes revelar tu premio!</CardDescription>
        </CardHeader>
        <CardContent>
           <Button onClick={prepareNewGame} className="w-full" variant="outline">
            <RotateCcw className="mr-2" /> Jugar Trivia de Nuevo
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gameState === "gameOver") {
    return (
      <Card className="w-full max-w-lg shadow-xl text-center">
        <CardHeader>
          <XCircle className="mx-auto h-16 w-16 text-destructive mb-4" />
          <CardTitle className="text-3xl font-headline text-destructive">Juego Terminado</CardTitle>
          <CardDescription>Conseguiste {score} de {TOTAL_QUESTIONS_TO_PLAY} respuestas correctas. Necesitas {QUESTIONS_TO_WIN} para ganar. ¡Inténtalo de nuevo!</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={prepareNewGame} className="w-full bg-primary hover:bg-primary/90 text-lg py-6">
            <RotateCcw className="mr-2" /> Reintentar Trivia
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-primary">Pregunta {currentQuestionIndex + 1} de {TOTAL_QUESTIONS_TO_PLAY}</CardTitle>
        <CardDescription className="text-lg min-h-[60px] pt-2">{currentQuestion?.questionText}</CardDescription>
         <p className="text-sm text-muted-foreground">Puntuación: {score} (Necesitas {QUESTIONS_TO_WIN} para ganar)</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {displayedOptions.length > 0 && (
          <RadioGroup 
            key={`radiogroup-${currentQuestion.id}`} // Change key when question changes to reset RadioGroup state
            value={selectedDisplayId ?? undefined} 
            onValueChange={handleOptionChange} 
            className="space-y-3" 
            disabled={gameState === "answered"}
          >
            {displayedOptions.map((option) => (
              <Label
                key={option.displayId}
                htmlFor={`option-${option.displayId}-${currentQuestion.id}`}
                className={`flex items-center space-x-3 p-4 rounded-md border transition-all 
                  ${selectedDisplayId === option.displayId && gameState !== "answered" ? 'border-primary ring-2 ring-primary bg-primary/5' : 'border-border'}
                  ${gameState === "answered" && option.isCorrect ? 'bg-green-100 border-green-500 text-green-800 font-medium' : ''}
                  ${gameState === "answered" && selectedDisplayId === option.displayId && !option.isCorrect ? 'bg-red-100 border-red-500 text-red-800 line-through' : ''}
                  ${gameState === "answered" ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}
                `}
              >
                <RadioGroupItem value={option.displayId} id={`option-${option.displayId}-${currentQuestion.id}`} disabled={gameState === "answered"} />
                <span className="flex-1">{option.text}</span>
                 {gameState === "answered" && option.isCorrect && <CheckCircle className="h-5 w-5 text-green-600 ml-auto" />}
                {gameState === "answered" && selectedDisplayId === option.displayId && !option.isCorrect && <XCircle className="h-5 w-5 text-red-600 ml-auto" />}
              </Label>
            ))}
          </RadioGroup>
        )}

        {feedback && gameState !== 'answered' && feedback.type === 'incorrect_retry' && (
           <Alert 
            variant={'default'} 
            className={'bg-yellow-50 border-yellow-300 text-yellow-700 [&>svg]:text-yellow-600'}
          >
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Intento Fallido</AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}
         {feedback && gameState === 'answered' && (
          <Alert 
            variant={feedback.type === 'correct' ? 'default' : 'destructive'} 
            className={`${
                feedback.type === 'correct' ? 'bg-green-50 border-green-300 text-green-700 [&>svg]:text-green-600' 
              : 'bg-red-50 border-red-300 text-red-700 [&>svg]:text-red-600' // Only incorrect_final reaches here with gameState === 'answered'
            }`}
          >
            {feedback.type === 'correct' && <CheckCircle className="h-5 w-5" />}
            {feedback.type === 'incorrect_final' && <XCircle className="h-5 w-5" />}
            <AlertTitle>
                {feedback.type === 'correct' ? '¡Correcto!' : '¡Incorrecto!'}
            </AlertTitle>
            <AlertDescription>
                {feedback.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-end pt-4">
        {gameState === "playing" && (
          <Button 
            onClick={handleSubmitAnswer} 
            disabled={!selectedDisplayId} 
            className="bg-accent hover:bg-accent/90"
          >
            {hasUsedSecondChanceThisQuestion ? "Confirmar 2º Intento" : "Responder"}
          </Button>
        )}
        {gameState === "answered" && (
          <Button onClick={handleNextAction} className="bg-primary hover:bg-primary/90">
            {(currentQuestionIndex + 1 >= TOTAL_QUESTIONS_TO_PLAY) 
              ? "Ver Resultado Final" 
              : "Siguiente Pregunta"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

    

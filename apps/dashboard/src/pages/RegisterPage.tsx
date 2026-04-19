import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/config/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/Card';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    if (password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiClient.register(email, password, fullName);
      if (result.success) {
        toast.success('Conta criada! Verifique seu email para confirmar.');
        navigate({ to: '/login' });
      } else {
        toast.error(result.error?.message || 'Registro falhou');
      }
    } catch (error) {
      toast.error('Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-md">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-md">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
              <span className="font-display font-bold text-dark-900 text-xl">F</span>
            </div>
          </div>
          <CardTitle className="text-center">Criar Conta</CardTitle>
          <p className="text-center text-dark-400 text-body-sm mt-xs">
            Comece a usar o FlowDesk hoje
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-md">
            <Input
              label="Nome"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-sm" />
                  Criando...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>
          <div className="mt-md text-center">
            <a href="/login" className="text-brand-400 text-body-sm hover:text-brand-300">
              Já tem conta? Entrar
            </a>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
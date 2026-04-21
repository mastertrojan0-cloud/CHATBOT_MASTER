import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/Card';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Login falhou');
      }
    } catch (error) {
      toast.error('Erro ao fazer login');
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
          <CardTitle className="text-center">FlowDesk</CardTitle>
          <p className="text-center text-dark-400 text-body-sm mt-xs">
            Faça login para continuar
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-md">
            <Input
              id="login-email"
              name="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              id="login-password"
              name="password"
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
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
          <div className="mt-md text-center">
            <a href="/register" className="text-brand-400 text-body-sm hover:text-brand-300">
              Criar conta
            </a>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '@/config/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/Card';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [segment, setSegment] = useState('COMERCIO_GERAL');
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

    if (!fullName.trim()) {
      toast.error('Preencha o nome do negocio');
      return;
    }

    setIsLoading(true);
    try {
      const formData = {
        email,
        password,
        name: fullName,
        businessName: fullName,
        segment,
      };

      const payload = {
        email: formData.email,
        password: formData.password,
        businessName: (formData as any).nome || formData.name || formData.businessName,
        segment: formData.segment || 'COMERCIO_GERAL',
      };

      const result = await api.post('/auth/register', payload);
      const accessToken = result?.data?.accessToken || result?.data?.token;
      if (result?.success && accessToken) {
        sessionStorage.setItem('flowdesk_access', accessToken);
      }
      if (result.success) {
        toast.success('Conta criada com sucesso!');
        navigate('/dashboard');
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
              id="register-name"
              name="name"
              label="Nome"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              required
            />
            <Input
              id="register-email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              id="register-password"
              name="password"
              label="Senha"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Select
              id="register-segment"
              name="segment"
              label="Segmento"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              options={[
                { value: 'SALAO_BARBEARIA', label: 'Salão / Barbearia' },
                { value: 'RESTAURANTE', label: 'Restaurante' },
                { value: 'LOJA_ROUPAS', label: 'Loja de Roupas' },
                { value: 'AUTONOMO', label: 'Autônomo' },
                { value: 'COMERCIO_GERAL', label: 'Comércio Geral' },
                { value: 'CLINIC', label: 'Clínica / Consultório' },
                { value: 'DENTAL', label: 'Odontologia' },
                { value: 'FITNESS', label: 'Academia / Fitness' },
              ]}
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
